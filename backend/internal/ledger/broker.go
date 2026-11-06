package ledger

import (
	"encoding/csv"
	"errors"
	"io"
	"math/big"
	"strings"
	"time"
	"unicode/utf8"
)

type importRequest struct {
	Format    string            `json:"format"`
	CSV       string            `json:"csv"`
	AccountID string            `json:"account_id,omitempty"`
	Assets    map[string]string `json:"assets,omitempty"`
}

// Broker adapters never infer asset identity from a ticker or invent cash flows.
// The caller explicitly maps external symbols/ISINs to privately owned assets.
func parseBroker(in importRequest) ([]ImportRow, error) {
	if !utf8.ValidString(in.CSV) {
		return nil, errors.New("csv_must_be_utf8")
	}
	reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(in.CSV, "\ufeff")))
	reader.FieldsPerRecord = -1
	var header []string
	for i := 0; i < 20; i++ { // Coinbase permits a short report preamble.
		h, err := reader.Read()
		if err != nil {
			return nil, errors.New("broker_header_required")
		}
		if len(h) > 0 && ((in.Format == "coinbase-transactions-v1" && h[0] == "ID") || (in.Format == "trade-republic-transactions-v1" && h[0] == "datetime")) {
			header = h
			break
		}
		if in.Format != "coinbase-transactions-v1" {
			break
		}
	}
	required := []string{"ID", "Timestamp", "Transaction Type", "Asset", "Quantity Transacted", "Price Currency", "Price at Transaction", "Subtotal", "Total (inclusive of fees and/or spread)", "Fees and/or Spread", "Notes"}
	if in.Format == "trade-republic-transactions-v1" {
		required = strings.Split("datetime,date,account_type,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,currency,original_amount,original_currency,fx_rate,description,transaction_id,counterparty_name,counterparty_iban,payment_reference,mcc_code", ",")
	}
	seen := map[string]bool{}
	for _, h := range header {
		if seen[h] {
			return nil, errors.New("unsupported_or_duplicate_csv_column")
		}
		seen[h] = true
	}
	for _, h := range required {
		if !seen[h] {
			return nil, errors.New("unsupported_broker_header")
		}
	}
	if len(header) != len(required) && !(in.Format == "coinbase-transactions-v1" && len(header) == len(required)+2 && seen["Sender Address"] && seen["Recipient Address"]) {
		return nil, errors.New("unsupported_broker_header")
	}
	rows := []ImportRow{}
	keys := map[string]bool{}
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil || len(record) != len(header) {
			return nil, errors.New("invalid_csv_row")
		}
		if len(rows) >= 500 {
			return nil, errors.New("csv_batch_limit_500")
		}
		f := map[string]string{}
		for i, v := range record {
			f[header[i]] = v
		}
		line, _ := reader.FieldPos(0)
		row := ImportRow{Line: line, Event: Event{AccountID: in.AccountID}}
		if in.Format == "coinbase-transactions-v1" {
			row.ExternalID = "coinbase:" + f["ID"]
			row.Error = coinbaseEvent(f, in.Assets, &row.Event)
		} else {
			row.ExternalID = "trade-republic:" + f["transaction_id"]
			row.Error = tradeRepublicEvent(f, in.Assets, &row.Event)
		}
		id := f["ID"]
		if in.Format == "trade-republic-transactions-v1" {
			id = f["transaction_id"]
		}
		if !text(id, 120) {
			row.Error = "external_id_required"
		}
		if row.Error == "" {
			if err = normalize(&row.Event); err != nil {
				row.Error = err.Error()
			}
		}
		key := csvKey(row)
		if keys[key] {
			row.Error = "duplicate_external_id_in_file"
		}
		keys[key] = true
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return nil, errors.New("empty_csv")
	}
	return rows, nil
}
func requiredNumber(s string) (*big.Rat, error) {
	if s == "" {
		return nil, errors.New("invalid_decimal")
	}
	return number(s)
}
func signedNumber(s string) (*big.Rat, error) {
	neg := strings.HasPrefix(s, "-")
	n, err := requiredNumber(strings.TrimPrefix(s, "-"))
	if err == nil && neg {
		n.Neg(n)
	}
	return n, err
}
func brokerAsset(symbol string, assets map[string]string, e *Event) string {
	e.AssetID = assets[symbol]
	if e.AssetID == "" {
		return "asset_mapping_required"
	}
	return ""
}
func coinbaseEvent(f, assets map[string]string, e *Event) string {
	e.At = f["Timestamp"]
	if t, err := time.Parse("2006-01-02 15:04:05 MST", e.At); err == nil && strings.HasSuffix(e.At, " UTC") {
		e.At = t.UTC().Format(time.RFC3339Nano)
	}
	if f["Price Currency"] != "EUR" {
		return "broker_eur_only"
	}
	if issue := brokerAsset(f["Asset"], assets, e); issue != "" {
		return issue
	}
	e.Quantity = f["Quantity Transacted"]
	e.Price = f["Price at Transaction"]
	e.Fees = f["Fees and/or Spread"]
	total, err := requiredNumber(f["Total (inclusive of fees and/or spread)"])
	if err != nil {
		return "invalid_decimal"
	}
	subtotal, err := requiredNumber(f["Subtotal"])
	if err != nil {
		return "invalid_decimal"
	}
	fees, err := requiredNumber(e.Fees)
	if err != nil {
		return "invalid_decimal"
	}
	q, err := requiredNumber(e.Quantity)
	if err != nil {
		return "invalid_decimal"
	}
	p, err := requiredNumber(e.Price)
	if err != nil {
		return "invalid_decimal"
	}
	if mul(q, p).Cmp(subtotal) != 0 {
		return "broker_rounded_trade_requires_review"
	}
	switch f["Transaction Type"] {
	case "Buy":
		e.Kind = "buy"
		if add(subtotal, fees).Cmp(total) != 0 {
			return "inconsistent_total"
		}
	case "Sell":
		e.Kind = "sell"
		if sub(subtotal, fees).Cmp(total) != 0 {
			return "inconsistent_total"
		}
	case "Staking Income":
		e.Kind = "staking"
		e.PriceSource = "Coinbase CSV at reception"
		e.PriceObservedAt = e.At
		if fees.Sign() != 0 || total.Cmp(subtotal) != 0 {
			return "inconsistent_total"
		}
		e.Fees = ""
		return ""
	default:
		return "unsupported_operation"
	}
	e.Amount = f["Total (inclusive of fees and/or spread)"]
	return ""
}
func tradeRepublicEvent(f, assets map[string]string, e *Event) string {
	e.At = f["datetime"]
	if f["currency"] != "EUR" || f["original_currency"] != "" && f["original_currency"] != "EUR" || f["fx_rate"] != "" {
		return "broker_eur_only"
	}
	if f["account_type"] != "DEFAULT" {
		return "unsupported_broker_account"
	}
	tax, err := number(strings.TrimPrefix(f["tax"], "-"))
	if err != nil {
		return "invalid_decimal"
	}
	if tax.Sign() != 0 {
		return "broker_tax_requires_review"
	}
	amount, err := signedNumber(f["amount"])
	if err != nil {
		return "invalid_decimal"
	}
	fee, err := number(f["fee"])
	if err != nil {
		return "invalid_decimal"
	}
	e.Fees = f["fee"]
	switch f["category"] + "|" + f["type"] {
	case "TRADING|BUY", "TRADING|SELL":
		if issue := brokerAsset(f["symbol"], assets, e); issue != "" {
			return issue
		}
		q, err := signedNumber(f["shares"])
		if err != nil {
			return "invalid_decimal"
		}
		e.Price = f["price"]
		e.Quantity = strings.TrimPrefix(f["shares"], "-")
		p, err := requiredNumber(e.Price)
		if err != nil {
			return "invalid_decimal"
		}
		total := new(big.Rat).Abs(amount)
		gross := mul(new(big.Rat).Abs(q), p)
		if f["type"] == "BUY" {
			e.Kind = "buy"
			if q.Sign() <= 0 || amount.Sign() >= 0 {
				return "broker_invalid_sign"
			}
			if add(gross, fee).Cmp(total) != 0 {
				return "broker_rounded_trade_requires_review"
			}
		} else {
			e.Kind = "sell"
			if q.Sign() >= 0 || amount.Sign() <= 0 {
				return "broker_invalid_sign"
			}
			if sub(gross, fee).Cmp(total) != 0 {
				return "broker_rounded_trade_requires_review"
			}
		}
		e.Amount = strings.TrimPrefix(f["amount"], "-")
	case "CASH|INTEREST_PAYMENT", "CASH|DIVIDEND":
		if amount.Sign() <= 0 || fee.Sign() != 0 {
			return "broker_invalid_sign"
		}
		e.Kind = "interest"
		if f["type"] == "DIVIDEND" {
			e.Kind = "dividend"
			if issue := brokerAsset(f["symbol"], assets, e); issue != "" {
				return issue
			}
		}
		e.Amount = f["amount"]
		e.Fees = ""
	default:
		// A transfer may be internal to another tracked account: never infer deposit.
		return "unsupported_operation"
	}
	return ""
}
