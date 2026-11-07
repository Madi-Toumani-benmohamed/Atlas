package ledger

import (
	"strings"
	"testing"
)

func TestCanonicalDerivedQuantityCanBeLiquidated(t *testing.T) {
	const capital = "1000000000000000000"
	const price = "0.000000000000000001"
	accounts := map[string]Account{"a": {Currency: "EUR"}}
	events := []Event{
		{Kind: "deposit", AccountID: "a", Amount: capital, At: "2020-01-01T00:00:00Z"},
		{Kind: "buy", AccountID: "a", AssetID: "asset", Amount: capital, Price: price, At: "2020-01-02T00:00:00Z"},
	}
	book, err := Replay(events, accounts)
	if err != nil {
		t.Fatal(err)
	}
	quantity := book.Positions["a"]["asset"].Quantity.RatString()
	if len(quantity) != 37 {
		t.Fatal("fixture did not reach the canonical integer boundary")
	}
	fraction, err := quantityNumber(quantity + "/1")
	if err != nil || fraction.Cmp(book.Positions["a"]["asset"].Quantity) != 0 {
		t.Fatal("equivalent fraction should already be supported")
	}
	events = append(events, Event{Kind: "sell", AccountID: "a", AssetID: "asset", Quantity: quantity, Price: price, At: "2020-01-03T00:00:00Z"})
	book, err = Replay(events, accounts)
	if err != nil {
		t.Fatalf("canonical derived quantity cannot be liquidated: %v", err)
	}
	exact(t, book.Cash["a"], capital)
	exact(t, book.Positions["a"]["asset"].Quantity, "0")
	exact(t, book.Positions["a"]["asset"].Cost, "0")
	exact(t, book.Positions["a"]["asset"].Realized, "0")
}

func TestCanonicalQuantityEncodingBoundaries(t *testing.T) {
	for _, tc := range []struct {
		name, text string
		valid      bool
	}{
		{"large integer", "1" + strings.Repeat("0", 36), true},
		{"same value as fraction", "1" + strings.Repeat("0", 36) + "/1", true},
		{"largest equivalent integer", strings.Repeat("9", 8190), true},
		{"beyond equivalent fraction bound", strings.Repeat("9", 8191), false},
		{"negative integer", "-1" + strings.Repeat("0", 36), false},
		{"noncanonical leading zero", "0" + strings.Repeat("1", 36), false},
		{"exponent notation", "1e36", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := quantityNumber(tc.text)
			if (err == nil) != tc.valid {
				t.Fatalf("quantity validity = %v, expected %v", err == nil, tc.valid)
			}
		})
	}
}
