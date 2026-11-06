package ledger

import (
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestReconciliationExactHistoricalSnapshots(t *testing.T) {
	account := map[string]Account{"a": {Currency: "EUR"}, "b": {Currency: "EUR"}}
	operations := []Operation{
		{Event: Event{Kind: "deposit", AccountID: "a", Amount: "1000", At: "2020-01-01T12:00:00Z", Order: 1}, Active: true},
		{Event: Event{Kind: "buy", AccountID: "a", AssetID: "asset", Quantity: "5", Price: "100", At: "2020-01-02T12:00:00Z", Order: 2}, Active: true},
		{Event: Event{Kind: "transfer", AccountID: "a", TargetID: "b", AssetID: "asset", Quantity: "2", At: "2020-01-03T12:00:00Z", Order: 3}, Active: true},
	}
	for _, tc := range []struct {
		name, date, csv string
		complete        bool
		diffs           int
		actual, delta   string
	}{
		{"matching position and cash", "2020-01-02T13:00:00Z", "kind,asset_id,value\ncash,,500\nposition,asset,5\n", true, 0, "5", "0"},
		{"historical before purchase", "2020-01-01T13:00:00Z", "kind,asset_id,value\ncash,,1000\nposition,asset,0\n", true, 0, "0", "0"},
		{"transfer reflected only after date", "2020-01-03T13:00:00Z", "kind,asset_id,value\nposition,asset,5\n", false, 1, "3", "-2"},
		{"partial snapshot does not assert missing positions", "2020-01-02T13:00:00Z", "kind,asset_id,value\ncash,,500\n", false, 0, "500", "0"},
		{"complete snapshot detects missing holding", "2020-01-02T13:00:00Z", "kind,asset_id,value\ncash,,500\n", true, 1, "5", "5"},
		{"tiny discrepancy survives display rounding", "2020-01-02T13:00:00Z", "kind,asset_id,value\nposition,asset,4.999999999\n", false, 1, "5", "1/1000000000"},
		{"negative statement cash compared without booking debt", "2020-01-02T13:00:00Z", "kind,asset_id,value\ncash,,-5\n", false, 1, "500", "505"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			at, _ := time.Parse(time.RFC3339, tc.date)
			book, err := Replay(events(operations, at), account)
			if err != nil {
				t.Fatal(err)
			}
			refs, err := parseBalances(tc.csv)
			if err != nil {
				t.Fatal(err)
			}
			report, err := reconcile("a", "EUR", at, tc.complete, refs, book, map[string]string{"asset": "Synthetic"})
			if err != nil {
				t.Fatal(err)
			}
			last := report.Rows[len(report.Rows)-1]
			if report.Differences != tc.diffs || last.Actual.Exact != tc.actual || last.Delta.Exact != tc.delta {
				t.Fatalf("unexpected comparison: %+v", report)
			}
			if len(operations) != 3 || book.Cash["a"].RatString() != "500" && tc.name != "historical before purchase" {
				t.Fatal("comparison mutated journal/book")
			}
		})
	}
}
func TestBalanceCSVBoundaries(t *testing.T) {
	for _, tc := range []struct {
		name, csv string
		valid     bool
	}{
		{"fraction and BOM CRLF", "\ufeffkind,asset_id,value\r\nposition,asset,100/3\r\n", true},
		{"duplicate position", "kind,asset_id,value\nposition,a,1\nposition,a,2\n", false},
		{"duplicate cash", "kind,asset_id,value\ncash,,1\ncash,,2\n", false},
		{"cash with asset", "kind,asset_id,value\ncash,a,1\n", false},
		{"unknown kind", "kind,asset_id,value\ndeposit,,1\n", false},
		{"empty value", "kind,asset_id,value\nposition,a,\n", false},
		{"header only", "kind,asset_id,value\n", false},
		{"duplicate header", "kind,value,value\ncash,,1\n", false},
		{"unknown column", "kind,asset_id,value,note\ncash,,1,\n", false},
		{"malformed row", "kind,asset_id,value\ncash,1\n", false},
		{"binary financial input", "kind,asset_id,value\ncash,,NaN\n", false},
		{"500 rows", balanceCSVFixture(500), true},
		{"501 rows", balanceCSVFixture(501), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := parseBalances(tc.csv)
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v error=%v", tc.valid, err)
			}
		})
	}
}
func TestReconciliationRecurringQuantityAndPartialHistory(t *testing.T) {
	book, err := Replay([]Event{{Kind: "opening_cash", AccountID: "a", Amount: "100", At: "2020-01-01T12:00:00Z", Order: 1}, {Kind: "buy", AccountID: "a", AssetID: "asset", Price: "3", Amount: "100", At: "2020-01-01T13:00:00Z", Order: 2}}, map[string]Account{"a": {Currency: "EUR"}})
	if err != nil {
		t.Fatal(err)
	}
	refs, err := parseBalances("kind,asset_id,value\ncash,,0\nposition,asset,100/3\n")
	if err != nil {
		t.Fatal(err)
	}
	report, err := reconcile("a", "EUR", time.Now(), true, refs, book, map[string]string{"asset": "Synthetic"})
	if err != nil {
		t.Fatal(err)
	}
	if !report.PartialHistory || !report.CashChecked || report.Differences != 0 || report.Rows[1].Actual.Exact != "100/3" {
		t.Fatalf("%+v", report)
	}
}

func balanceCSVFixture(n int) string {
	var b strings.Builder
	b.WriteString("kind,asset_id,value\n")
	for i := 0; i < n; i++ {
		b.WriteString("position,a" + strconv.Itoa(i) + ",1\n")
	}
	return b.String()
}
