package ledger

import (
	"math/big"
	"testing"
	"time"
)

func fixture(kind, account, quantity, price, amount string) Event {
	return Event{Kind: kind, AccountID: account, AssetID: func() string {
		if quantity != "" {
			return "asset"
		}
		return ""
	}(), Quantity: quantity, Price: price, Amount: amount, At: "2020-01-01T12:00:00Z"}
}
func exact(t *testing.T, got *big.Rat, want string) {
	t.Helper()
	n, ok := new(big.Rat).SetString(want)
	if !ok || got.Cmp(n) != 0 {
		t.Fatalf("got %s want %s", got.RatString(), want)
	}
}
func TestFinancialScenarios(t *testing.T) {
	accounts := map[string]Account{"a": {Currency: "EUR"}, "b": {Currency: "EUR"}}
	base := []Event{fixture("deposit", "a", "", "", "2000"), fixture("buy", "a", "5", "100", ""), fixture("buy", "a", "5", "120", "")}
	for i := range base {
		base[i].Order = int64(i + 1)
	}
	for _, tc := range []struct {
		name                           string
		events                         []Event
		cash, quantity, cost, realized string
	}{
		{"T01 weighted average", base, "900", "10", "1100", "0"},
		{"T03 partial sale", append(append([]Event{}, base...), Event{Kind: "sell", AccountID: "a", AssetID: "asset", At: "2020-01-02T12:00:00Z", Quantity: "4", Price: "130", Fees: "2"}), "1418", "6", "660", "78"},
		{"total includes fees", []Event{fixture("deposit", "a", "", "", "1000"), {Kind: "buy", AccountID: "a", AssetID: "asset", At: "2020-01-01T12:00:00Z", Price: "10", Amount: "100", Fees: "1"}}, "900", "99/10", "100", "0"},
		{"recurring quantity stays exact", []Event{fixture("deposit", "a", "", "", "100"), {Kind: "buy", AccountID: "a", AssetID: "asset", At: "2020-01-01T12:00:00Z", Price: "3", Amount: "100"}}, "0", "100/3", "100", "0"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, err := Replay(tc.events, accounts)
			if err != nil {
				t.Fatal(err)
			}
			p := b.Positions["a"]["asset"]
			exact(t, b.Cash["a"], tc.cash)
			exact(t, p.Quantity, tc.quantity)
			exact(t, p.Cost, tc.cost)
			exact(t, p.Realized, tc.realized)
		})
	}
	b, err := Replay(base, accounts)
	if err != nil {
		t.Fatal(err)
	}
	exact(t, div(b.Positions["a"]["asset"].Cost, b.Positions["a"]["asset"].Quantity), "110")
	exact(t, b.ExternalEUR, "2000")
	t.Run("sell a recurring calculated quantity exactly", func(t *testing.T) {
		es := []Event{fixture("deposit", "a", "", "", "100"), {Kind: "buy", AccountID: "a", AssetID: "asset", At: "2020-01-01T12:00:00Z", Price: "3", Amount: "100"}, {Kind: "sell", AccountID: "a", AssetID: "asset", At: "2020-01-02T12:00:00Z", Quantity: "100/3", Price: "3"}}
		b, err := Replay(es, accounts)
		if err != nil {
			t.Fatal(err)
		}
		exact(t, b.Positions["a"]["asset"].Quantity, "0")
		exact(t, b.Positions["a"]["asset"].Cost, "0")
		exact(t, b.Cash["a"], "100")
	})
	t.Run("T04 no double external flow", func(t *testing.T) {
		b, err := Replay([]Event{fixture("deposit", "a", "", "", "1000"), fixture("buy", "a", "10", "100", "")}, accounts)
		if err != nil {
			t.Fatal(err)
		}
		exact(t, b.ExternalEUR, "1000")
		exact(t, b.Cash["a"], "0")
	})
	t.Run("T05 transfer conservation", func(t *testing.T) {
		es := []Event{fixture("deposit", "a", "", "", "1000"), {Kind: "transfer", AccountID: "a", TargetID: "b", Amount: "200", At: "2020-01-02T12:00:00Z"}}
		b, err := Replay(es, accounts)
		if err != nil {
			t.Fatal(err)
		}
		exact(t, b.Cash["a"], "800")
		exact(t, b.Cash["b"], "200")
		exact(t, b.ExternalEUR, "1000")
	})
	t.Run("security transfer carries proportional cost", func(t *testing.T) {
		es := append(append([]Event{}, base...), Event{Kind: "transfer", AccountID: "a", TargetID: "b", AssetID: "asset", Quantity: "4", At: "2020-01-02T12:00:00Z"})
		b, err := Replay(es, accounts)
		if err != nil {
			t.Fatal(err)
		}
		exact(t, b.Positions["a"]["asset"].Cost, "660")
		exact(t, b.Positions["b"]["asset"].Cost, "440")
		exact(t, b.Positions["b"]["asset"].Quantity, "4")
		exact(t, b.ExternalEUR, "2000")
	})
	t.Run("T11 staking cost and income", func(t *testing.T) {
		e := fixture("staking", "a", "2", "100", "")
		e.PriceSource = "synthetic fixture"
		e.PriceObservedAt = e.At
		b, err := Replay([]Event{e}, accounts)
		if err != nil {
			t.Fatal(err)
		}
		exact(t, b.Positions["a"]["asset"].Quantity, "2")
		exact(t, b.Positions["a"]["asset"].Cost, "200")
		exact(t, b.IncomeEUR, "200")
		exact(t, b.Cash["a"], "0")
	})
	t.Run("T12 credited interest", func(t *testing.T) {
		b, err := Replay([]Event{fixture("deposit", "a", "", "", "1000"), fixture("interest", "a", "", "", "10")}, accounts)
		if err != nil {
			t.Fatal(err)
		}
		exact(t, b.Cash["a"], "1010")
		exact(t, b.IncomeEUR, "10")
		exact(t, b.ExternalEUR, "1000")
	})
	t.Run("opening never invents cash or cost", func(t *testing.T) {
		e := fixture("opening_position", "a", "5", "", "")
		b, err := Replay([]Event{e}, accounts)
		if err != nil {
			t.Fatal(err)
		}
		if !b.Partial || b.KnownExternal || b.Positions["a"]["asset"].KnownCost {
			t.Fatal("unknown history presented as known")
		}
		exact(t, b.Cash["a"], "0")
	})
}
func TestRejectedHistories(t *testing.T) {
	accounts := map[string]Account{"a": {Currency: "EUR"}, "b": {Currency: "USD"}}
	for _, tc := range []struct {
		name   string
		events []Event
	}{
		{"buy without funding", []Event{fixture("buy", "a", "1", "100", "")}},
		{"short sale", []Event{fixture("sell", "a", "1", "100", "")}},
		{"negative quantity", []Event{fixture("buy", "a", "-1", "100", "")}},
		{"ambiguous total", []Event{{Kind: "buy", AccountID: "a", AssetID: "asset", At: "2020-01-01T12:00:00Z", Quantity: "1", Price: "10", Amount: "11"}}},
		{"swap unsupported", []Event{fixture("swap", "a", "1", "100", "")}},
		{"staking undated", []Event{fixture("staking", "a", "1", "100", "")}},
		{"transfer missing FX", []Event{fixture("deposit", "a", "", "", "1000"), {Kind: "transfer", AccountID: "a", TargetID: "b", Amount: "200", At: "2020-01-01T12:00:00Z"}}},
		{"backdated unfunded buy", []Event{{Kind: "deposit", AccountID: "a", Amount: "1000", At: "2020-01-02T12:00:00Z"}, fixture("buy", "a", "1", "100", "")}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := Replay(tc.events, accounts); err == nil {
				t.Fatal("inconsistent history accepted")
			}
		})
	}
}
func TestValuationsAndHistory(t *testing.T) {
	d := &Data{Accounts: map[string]Account{"a": {Currency: "EUR"}}, AccountInfo: map[string]AccountInfo{"a": {ID: "a", Currency: "EUR", Kind: "brokerage"}}, Assets: map[string]AssetInfo{"asset": {ID: "asset", Name: "Synthetic", Kind: "stock"}}, Operations: []Operation{}, Prices: []Price{}}
	for i, e := range []Event{fixture("deposit", "a", "", "", "2000"), fixture("buy", "a", "5", "100", ""), fixture("buy", "a", "5", "120", "")} {
		e.Order = int64(i + 1)
		d.Operations = append(d.Operations, Operation{Event: e, Active: true})
	}
	at := time.Date(2020, 1, 3, 12, 0, 0, 0, time.UTC)
	t.Run("T08 missing price is not zero", func(t *testing.T) {
		s, err := d.calculate(at)
		if err != nil {
			t.Fatal(err)
		}
		if s.Total != nil || !s.Missing || s.Positions[0].ValueEUR != nil {
			t.Fatal("missing quote became zero")
		}
	})
	d.Prices = []Price{{AssetID: "asset", Currency: "EUR", Amount: "125", At: at, Source: "synthetic fixture", SourceType: "manual"}}
	t.Run("T02 total and unrealized", func(t *testing.T) {
		s, err := d.calculate(at)
		if err != nil {
			t.Fatal(err)
		}
		if s.Total.Exact != "2150" || s.Result.Exact != "150" || s.Positions[0].Unrealized.Exact != "150" {
			t.Fatalf("wrong summary %+v", s)
		}
	})
	t.Run("historical holdings not today holdings", func(t *testing.T) {
		s, err := d.calculate(time.Date(2019, 12, 31, 12, 0, 0, 0, time.UTC))
		if err != nil {
			t.Fatal(err)
		}
		if s.Total.Exact != "0" || len(s.Positions) != 0 {
			t.Fatal("future holdings used in past")
		}
	})
	t.Run("native result remains known when EUR FX is missing", func(t *testing.T) {
		usd := *d
		usd.Accounts = map[string]Account{"a": {Currency: "USD"}}
		usd.AccountInfo = map[string]AccountInfo{"a": {ID: "a", Currency: "USD", Kind: "brokerage"}}
		usd.Prices = []Price{{AssetID: "asset", Currency: "USD", Amount: "125", At: at, Source: "synthetic", SourceType: "manual"}}
		out, err := usd.calculate(at)
		if err != nil {
			t.Fatal(err)
		}
		if out.Total != nil || !out.Missing || out.Positions[0].Unrealized == nil || out.Positions[0].Unrealized.Exact != "150" {
			t.Fatal("missing FX hid known native result or invented EUR")
		}
	})
	t.Run("older quote is labelled and not a fabricated daily move", func(t *testing.T) {
		out, err := d.calculate(at.Add(24 * time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		if !out.OldObservations || out.Positions[0].MarketChanges["day"] != nil {
			t.Fatal("stale quote pretended current or zero daily change")
		}
	})
	t.Run("T10 dated FX", func(t *testing.T) {
		p := d.Prices[0]
		p.Currency = "USD"
		p.Amount = "100"
		d.Prices = []Price{p, {Currency: "USD", Amount: "0.9", At: at, Source: "synthetic fixture", SourceType: "manual"}}
		s, err := d.calculate(at)
		if err != nil {
			t.Fatal(err)
		}
		if s.Positions[0].ValueEUR.Exact != "900" {
			t.Fatal("dated FX not used")
		}
		s, err = d.calculate(at.Add(-time.Second))
		if err != nil {
			t.Fatal(err)
		}
		if !s.Missing {
			t.Fatal("future FX/quote leaked into history")
		}
	})
}
func TestInstrumentConsolidationAcrossAccounts(t *testing.T) {
	accounts := map[string]Account{"a": {Currency: "EUR"}, "b": {Currency: "EUR"}}
	d := &Data{Accounts: accounts, AccountInfo: map[string]AccountInfo{"a": {ID: "a", Currency: "EUR"}, "b": {ID: "b", Currency: "EUR"}}, Assets: map[string]AssetInfo{"asset": {ID: "asset", Name: "Synthetic", Kind: "stock"}}}
	es := []Event{fixture("deposit", "a", "", "", "2000"), fixture("buy", "a", "5", "100", ""), fixture("buy", "a", "5", "120", ""), {Kind: "transfer", AccountID: "a", TargetID: "b", AssetID: "asset", Quantity: "4", At: "2020-01-02T12:00:00Z"}}
	for i, e := range es {
		e.Order = int64(i + 1)
		d.Operations = append(d.Operations, Operation{Event: e, Active: true})
	}
	at := time.Date(2020, 1, 3, 12, 0, 0, 0, time.UTC)
	d.Prices = []Price{{AssetID: "asset", Currency: "EUR", Amount: "125", At: at, SourceType: "manual"}}
	out, err := d.calculate(at)
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Consolidated) != 1 || len(out.Positions) != 2 || out.Consolidated[0].Quantity.Exact != "10" || out.Consolidated[0].AverageCost.Exact != "110" || out.Consolidated[0].ValueEUR.Exact != "1250" || out.Total.Exact != "2150" {
		t.Fatal("instrument duplicated or cost changed across accounts")
	}
}

func TestCalendarBoundaries(t *testing.T) {
	at := time.Date(2024, 3, 31, 12, 0, 0, 0, time.UTC)
	if monthBefore(at).Format("2006-01-02") != "2024-02-29" {
		t.Fatal("month not clamped")
	}
	if yearBefore(time.Date(2024, 2, 29, 12, 0, 0, 0, time.UTC)).Day() != 28 {
		t.Fatal("leap year not clamped")
	}
}
