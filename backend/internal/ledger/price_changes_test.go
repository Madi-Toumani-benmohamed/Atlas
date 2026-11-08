package ledger

import (
	"sort"
	"testing"
	"time"
)

func TestMarketChangesWithoutHoldingsRespectDatesCurrenciesAndExactMath(t *testing.T) {
	at, _ := time.Parse(time.RFC3339, "2024-03-31T12:00:00Z")
	type observation struct{ date, currency, amount string }
	for _, tc := range []struct {
		name         string
		observations []observation
		expected     map[string]string
	}{
		{name: "all periods and clamped leap month", observations: []observation{{"2023-03-31", "EUR", "44"}, {"2024-02-29", "EUR", "55"}, {"2024-03-24", "EUR", "88"}, {"2024-03-30", "EUR", "100"}, {"2024-03-31", "EUR", "110"}}, expected: map[string]string{"day": "10", "week": "25", "month": "100", "year": "150"}},
		{name: "nonterminating percentage", observations: []observation{{"2024-03-30", "USD", "3"}, {"2024-03-31", "USD", "4"}}, expected: map[string]string{"day": "100/3"}},
		{name: "negative market move", observations: []observation{{"2024-03-30", "EUR", "4"}, {"2024-03-31", "EUR", "3"}}, expected: map[string]string{"day": "-25"}},
		{name: "known zero move", observations: []observation{{"2024-03-30", "EUR", "5"}, {"2024-03-31", "EUR", "5"}}, expected: map[string]string{"day": "0"}},
		{name: "currency mismatch", observations: []observation{{"2024-03-30", "EUR", "100"}, {"2024-03-31", "USD", "110"}}},
		{name: "missing exact prior day", observations: []observation{{"2024-03-29", "EUR", "100"}, {"2024-03-31", "EUR", "110"}}},
		{name: "stale latest quote", observations: []observation{{"2024-03-29", "EUR", "100"}, {"2024-03-30", "EUR", "110"}}},
		{name: "no prior observations", observations: []observation{{"2024-03-31", "EUR", "110"}}},
		{name: "no observations"},
		{name: "zero denominator not accepted", observations: []observation{{"2024-03-30", "EUR", "0"}, {"2024-03-31", "EUR", "110"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := Data{}
			for _, p := range tc.observations {
				date, _ := time.Parse("2006-01-02", p.date)
				d.Prices = append(d.Prices, Price{AssetID: "owned", Currency: p.currency, Amount: p.amount, At: date})
			}
			// Other instruments and FX must never become the denominator for this asset.
			d.Prices = append(d.Prices, Price{AssetID: "other", Currency: "EUR", Amount: "999", At: at}, Price{Currency: "EUR", Amount: "1", At: at})
			sort.SliceStable(d.Prices, func(i, j int) bool { return d.Prices[i].At.Before(d.Prices[j].At) })
			result := d.marketChanges("owned", d.quote("owned", "", at), at)
			if len(result) != 4 {
				t.Fatal("period coverage missing")
			}
			for _, period := range []string{"day", "week", "month", "year"} {
				want, exists := tc.expected[period]
				if !exists {
					if result[period] != nil {
						t.Fatalf("%s must be unavailable", period)
					}
					continue
				}
				if result[period] == nil || result[period].Exact != want {
					t.Fatalf("%s: %#v, expected %s", period, result[period], want)
				}
			}
			if tc.name == "nonterminating percentage" && (!result["day"].Approximate || result["day"].Display != "33.33") {
				t.Fatal("percentage rounded before preserving exact value")
			}
			projection := changesForPrices(d.Prices, at)
			if _, exists := projection[""]; exists {
				t.Fatal("FX projected as an asset")
			}
			for _, period := range []string{"day", "week", "month", "year"} {
				if result[period] != nil && projection["owned"][period].Exact != result[period].Exact {
					t.Fatal("catalogue differs from held-position calculation")
				}
			}
		})
	}
}
