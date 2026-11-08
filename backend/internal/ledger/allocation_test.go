package ledger

import (
	"math/big"
	"testing"
	"time"
)

func allocationFixture(unknown, transfer bool) Data {
	d := Data{
		PortfolioIDs: []string{"first", "second", "empty"},
		Accounts:     map[string]Account{"a": {Currency: "EUR"}, "s": {Currency: "EUR"}, "b": {Currency: "USD"}},
		AccountInfo:  map[string]AccountInfo{"a": {ID: "a", PortfolioID: "first", Currency: "EUR", Kind: "brokerage"}, "s": {ID: "s", PortfolioID: "first", Currency: "EUR", Kind: "savings"}, "b": {ID: "b", PortfolioID: "second", Currency: "USD", Kind: "brokerage"}},
		Assets:       map[string]AssetInfo{"stock": {ID: "stock", Kind: "stock"}, "etf": {ID: "etf", Kind: "etf"}, "unknown": {ID: "unknown", Kind: "stock"}},
	}
	events := []Event{
		{Kind: "deposit", AccountID: "a", Amount: "100", At: "2020-01-01T00:00:00Z"},
		{Kind: "buy", AccountID: "a", AssetID: "stock", Quantity: "2", Price: "10", Fees: "1", At: "2020-01-01T01:00:00Z"},
		{Kind: "deposit", AccountID: "s", Amount: "50", At: "2020-01-01T00:00:00Z"},
		{Kind: "interest", AccountID: "s", Amount: "2", At: "2020-01-01T01:00:00Z"},
		{Kind: "opening_cash", AccountID: "b", Amount: "10", At: "2020-01-01T00:00:00Z"},
		{Kind: "opening_position", AccountID: "b", AssetID: "etf", Quantity: "1", At: "2020-01-01T01:00:00Z"},
		{Kind: "sell", AccountID: "b", AssetID: "etf", Quantity: "1", Price: "4", At: "2020-01-04T00:00:00Z"},
	}
	if unknown {
		events = append(events, Event{Kind: "opening_position", AccountID: "a", AssetID: "unknown", Quantity: "1", At: "2020-01-01T02:00:00Z"})
	}
	if transfer {
		events = append(events, Event{Kind: "transfer", AccountID: "a", TargetID: "b", Amount: "20", ExchangeRate: "2", FXSource: "Synthetic transfer", FXObservedAt: "2020-01-03T01:00:00Z", At: "2020-01-03T01:00:00Z"})
	}
	for _, e := range events {
		d.Operations = append(d.Operations, Operation{Event: e, Active: true})
	}
	for _, p := range []struct{ asset, currency, amount, at string }{
		{"stock", "EUR", "12", "2020-01-02T00:00:00Z"},
		{"etf", "EUR", "8", "2020-01-03T00:00:00Z"},
		{"unknown", "EUR", "7", "2020-01-03T00:00:00Z"},
		{"", "USD", "0.5", "2020-01-03T00:00:00Z"},
	} {
		at, _ := time.Parse(time.RFC3339, p.at)
		d.Prices = append(d.Prices, Price{AssetID: p.asset, Currency: p.currency, Amount: p.amount, At: at})
	}
	return d
}

func TestPortfolioAllocationPreservesExactValuesAndScope(t *testing.T) {
	for _, tc := range []struct {
		name, date, first, second            string
		unknown, transfer, missing           bool
		stock, cash, savings, otherCash, etf string
	}{
		{name: "complete first despite missing second", date: "2020-01-02T12:00:00Z", first: "155", second: "", stock: "24", cash: "79", savings: "52"},
		{name: "partial first keeps known components", date: "2020-01-02T12:00:00Z", first: "155", second: "", unknown: true, missing: true, stock: "24", cash: "79", savings: "52"},
		{name: "dated FX and quote complete values", date: "2020-01-03T12:00:00Z", first: "162", second: "13", unknown: true, stock: "31", cash: "79", savings: "52", otherCash: "5", etf: "8"},
		{name: "transfer moves value without doubling", date: "2020-01-03T12:00:00Z", first: "142", second: "33", unknown: true, transfer: true, stock: "31", cash: "59", savings: "52", otherCash: "25", etf: "8"},
		{name: "closed ETF excluded from categories", date: "2020-01-04T12:00:00Z", first: "162", second: "7", unknown: true, stock: "31", cash: "79", savings: "52", otherCash: "7"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := allocationFixture(tc.unknown, tc.transfer)
			at, _ := time.Parse(time.RFC3339, tc.date)
			summary, err := d.calculate(at)
			if err != nil {
				t.Fatal(err)
			}
			empty, exists := summary.PortfolioAllocations["empty"]
			if !exists || empty.Missing || empty.Total == nil || empty.Total.Exact != "0" || empty.Known.Exact != "0" || len(empty.Categories) != 0 {
				t.Fatal("empty owned portfolio is not known zero")
			}
			first := summary.PortfolioAllocations["first"]
			wantOld := tc.date[:10] > "2020-01-02"
			if first.OldObservations != wantOld {
				t.Fatal("price freshness escaped portfolio scope")
			}

			if first.Known.Exact != tc.first || first.Missing != tc.missing || (first.Total == nil) != tc.missing {
				t.Fatalf("first allocation: %#v", first)
			}
			for kind, want := range map[string]string{"stock": tc.stock, "cash": tc.cash, "savings": tc.savings} {
				if first.Categories[kind].Exact != want {
					t.Fatalf("first %s: %s", kind, first.Categories[kind].Exact)
				}
			}
			second := summary.PortfolioAllocations["second"]
			if second.OldObservations != (tc.date[:10] > "2020-01-03") {
				t.Fatal("FX freshness escaped portfolio scope")
			}

			if tc.second == "" {
				if !second.Missing || second.Total != nil || second.Known.Exact != "0" || len(second.Categories) != 0 {
					t.Fatal("missing data turned into a known total")
				}
			} else {
				if second.Missing || second.Total == nil || second.Total.Exact != tc.second || second.Known.Exact != tc.second || second.Categories["cash"].Exact != tc.otherCash {
					t.Fatalf("second allocation: %#v", second)
				}
				if tc.etf != "" {
					if second.Categories["etf"].Exact != tc.etf {
						t.Fatal("ETF value wrong")
					}
				} else if _, exists := second.Categories["etf"]; exists {
					t.Fatal("closed position introduced an allocation category")
				}
			}
			total := zero()
			for _, entry := range summary.PortfolioAllocations {
				sum := zero()
				for _, n := range entry.Categories {
					v, _ := new(big.Rat).SetString(n.Exact)
					sum.Add(sum, v)
				}
				if sum.RatString() != entry.Known.Exact {
					t.Fatal("category amounts disagree with known value")
				}
				total.Add(total, sum)
			}
			if total.RatString() != summary.Known.Exact {
				t.Fatal("portfolios double-counted the global known value")
			}
		})
	}
}

func TestPortfolioAllocationSumsExactFractionsBeforeDisplayRounding(t *testing.T) {
	at, _ := time.Parse(time.RFC3339, "2020-01-02T12:00:00Z")
	d := Data{Accounts: map[string]Account{"a": {Currency: "EUR"}}, AccountInfo: map[string]AccountInfo{"a": {ID: "a", PortfolioID: "p", Currency: "EUR"}}, Assets: map[string]AssetInfo{}}
	for _, asset := range []string{"one", "two"} {
		d.Assets[asset] = AssetInfo{ID: asset, Kind: "stock"}
		d.Operations = append(d.Operations, Operation{Event: Event{Kind: "opening_position", AccountID: "a", AssetID: asset, Quantity: "1/3", At: "2020-01-01T00:00:00Z"}, Active: true})
		d.Prices = append(d.Prices, Price{AssetID: asset, Currency: "EUR", Amount: "1", At: at})
	}
	summary, err := d.calculate(at)
	if err != nil {
		t.Fatal(err)
	}
	entry := summary.PortfolioAllocations["p"]
	if entry.Known.Exact != "2/3" || entry.Total == nil || entry.Total.Exact != "2/3" || entry.Categories["stock"].Exact != "2/3" || entry.Categories["stock"].Display != "0.67" || !entry.Categories["stock"].Approximate {
		t.Fatal("allocation summed rounded display amounts")
	}
}
