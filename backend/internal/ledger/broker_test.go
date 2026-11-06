package ledger

import (
	"encoding/csv"
	"strings"
	"testing"
)

const cbHeader = "ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes"
const trHeader = "datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code"

func brokerCSV(h string, f map[string]string) string {
	header := strings.Split(h, ",")
	row := make([]string, len(header))
	for i, k := range header {
		row[i] = f[k]
	}
	var b strings.Builder
	w := csv.NewWriter(&b)
	_ = w.Write(header)
	_ = w.Write(row)
	w.Flush()
	return b.String()
}
func TestCoinbaseAdapter(t *testing.T) {
	for _, tc := range []struct{ kind, q, p, sub, total, fees, want, cash string }{
		{"Buy", "2", "100", "200", "201", "1", "", "799"}, {"Sell", "2", "130", "260", "259", "1", "", "1259"}, {"Staking Income", "0.5", "100", "50", "50", "0", "", "1000"}, {"Buy", "2", "100.0001", "200", "201", "1", "broker_rounded_trade_requires_review", ""}, {"Convert", "2", "100", "200", "200", "0", "unsupported_operation", ""},
	} {
		f := map[string]string{"ID": "id", "Timestamp": "2026-01-01 12:00:00 UTC", "Transaction Type": tc.kind, "Asset": "ETH", "Quantity Transacted": tc.q, "Price Currency": "EUR", "Price at Transaction": tc.p, "Subtotal": tc.sub, "Total (inclusive of fees and/or spread)": tc.total, "Fees and/or Spread": tc.fees}
		rows, err := parseBroker(importRequest{Format: "coinbase-transactions-v1", CSV: "Transactions\n\n" + brokerCSV(cbHeader, f), AccountID: "a", Assets: map[string]string{"ETH": "eth"}})
		if err != nil || len(rows) != 1 {
			t.Fatalf("%v %+v", err, rows)
		}
		if rows[0].Error != tc.want {
			t.Fatalf("%s: got %q want %q", tc.kind, rows[0].Error, tc.want)
		}
		if tc.want == "" {
			b, err := Replay([]Event{{Kind: "deposit", AccountID: "a", At: "2025-01-01T00:00:00Z", Amount: "1000"}, {Kind: "opening_position", AccountID: "a", AssetID: "eth", At: "2025-01-01T00:00:01Z", Quantity: "2", Cost: "200"}, rows[0].Event}, map[string]Account{"a": {Currency: "EUR"}})
			if err != nil {
				t.Fatal(err)
			}
			if b.Cash["a"].RatString() != tc.cash {
				t.Fatalf("cash %s", b.Cash["a"])
			}
		}
	}
}
func TestTradeRepublicAdapter(t *testing.T) {
	for _, tc := range []struct{ kind, category, q, p, amount, tax, want string }{
		{"BUY", "TRADING", "2", "100", "-201", "", ""}, {"SELL", "TRADING", "-2", "130", "259", "", ""}, {"BUY", "TRADING", "2", "100", "-201", "-1", "broker_tax_requires_review"}, {"BUY", "TRADING", "2", "100.001", "-201", "", "broker_rounded_trade_requires_review"}, {"SELL", "TRADING", "2", "130", "259", "", "broker_invalid_sign"}, {"TRANSFER_INSTANT_INBOUND", "CASH", "", "", "100", "", "unsupported_operation"},
	} {
		f := map[string]string{"datetime": "2026-01-01T10:00:00.123456Z", "account_type": "DEFAULT", "category": tc.category, "type": tc.kind, "symbol": "FR0000120271", "shares": tc.q, "price": tc.p, "amount": tc.amount, "fee": "1", "tax": tc.tax, "currency": "EUR", "transaction_id": "id"}
		rows, err := parseBroker(importRequest{Format: "trade-republic-transactions-v1", CSV: brokerCSV(trHeader, f), AccountID: "a", Assets: map[string]string{"FR0000120271": "asset"}})
		if err != nil || len(rows) != 1 {
			t.Fatalf("%v %+v", err, rows)
		}
		if rows[0].Error != tc.want {
			t.Fatalf("%s got %q want %q", tc.kind, rows[0].Error, tc.want)
		}
	}
}
func TestBrokerBoundaries(t *testing.T) {
	f := map[string]string{"ID": "id", "Timestamp": "2026-01-01T10:00:00Z", "Transaction Type": "Buy", "Asset": "ETH", "Quantity Transacted": "1", "Price Currency": "EUR", "Price at Transaction": "100", "Subtotal": "100", "Total (inclusive of fees and/or spread)": "100", "Fees and/or Spread": "0"}
	in := importRequest{Format: "coinbase-transactions-v1", CSV: brokerCSV(cbHeader, f), AccountID: "a"}
	rows, err := parseBroker(in)
	if err != nil || rows[0].Error != "asset_mapping_required" {
		t.Fatalf("%v %+v", err, rows)
	}
	in.Assets = map[string]string{"ETH": "asset"}
	rows, err = parseBroker(in)
	if err != nil || rows[0].Error != "" {
		t.Fatalf("%v %+v", err, rows)
	}
	first := importFingerprint(in)
	in.AccountID = "b"
	if first == importFingerprint(in) {
		t.Fatal("account missing in fingerprint")
	}
	in.AccountID = "a"
	in.Assets["ETH"] = "other"
	if first == importFingerprint(in) {
		t.Fatal("mapping missing in fingerprint")
	}
	in.CSV = strings.Replace(in.CSV, "ID,", "Timestamp,", 1)
	if _, err = parseBroker(in); err == nil {
		t.Fatal("duplicate header accepted")
	}
}
