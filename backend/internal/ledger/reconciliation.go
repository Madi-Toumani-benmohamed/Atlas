package ledger

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

type reconciliationRequest struct {
	Format            string `json:"format"`
	AccountID         string `json:"account_id"`
	Currency          string `json:"currency"`
	AsOf              string `json:"as_of"`
	CompletePositions bool   `json:"complete_positions"`
	CSV               string `json:"csv"`
}
type balanceReference struct {
	Line          int
	Kind, AssetID string
	Number        *big.Rat
}
type reconciliationRow struct {
	Line      int    `json:"line,omitempty"`
	Kind      string `json:"kind"`
	AssetID   string `json:"asset_id,omitempty"`
	AssetName string `json:"asset_name,omitempty"`
	Origin    string `json:"origin"`
	Expected  Value  `json:"expected"`
	Actual    Value  `json:"actual"`
	Delta     Value  `json:"delta"`
	Matches   bool   `json:"matches"`
}
type reconciliationReport struct {
	Format            string              `json:"format"`
	AccountID         string              `json:"account_id"`
	Currency          string              `json:"currency"`
	AsOf              time.Time           `json:"as_of"`
	CalculatedAt      time.Time           `json:"calculated_at"`
	PartialHistory    bool                `json:"partial_history"`
	CompletePositions bool                `json:"complete_positions"`
	CashChecked       bool                `json:"cash_checked"`
	Differences       int                 `json:"differences"`
	Rows              []reconciliationRow `json:"rows"`
}

func parseBalances(raw string) ([]balanceReference, error) {
	if !utf8.ValidString(raw) {
		return nil, errors.New("csv_must_be_utf8")
	}
	reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(raw, "\ufeff")))
	header, err := reader.Read()
	if err != nil || len(header) != 3 {
		return nil, errors.New("balances_header_required")
	}
	seen := map[string]bool{}
	for _, h := range header {
		if (h != "kind" && h != "asset_id" && h != "value") || seen[h] {
			return nil, errors.New("balances_header_required")
		}
		seen[h] = true
	}
	refs := []balanceReference{}
	keys := map[string]bool{}
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, errors.New("invalid_csv_row")
		}
		if len(refs) >= 500 {
			return nil, errors.New("csv_batch_limit_500")
		}
		f := map[string]string{}
		for i, v := range record {
			f[header[i]] = v
		}
		key := f["kind"] + ":" + f["asset_id"]
		if keys[key] {
			return nil, errors.New("duplicate_balance_reference")
		}
		keys[key] = true
		kind, id := f["kind"], f["asset_id"]
		if kind != "cash" && kind != "position" || kind == "cash" && id != "" || kind == "position" && !text(id, 160) {
			return nil, errors.New("invalid_balance_reference")
		}
		var n *big.Rat
		if kind == "position" {
			if f["value"] == "" {
				return nil, errors.New("invalid_quantity")
			}
			negative := strings.HasPrefix(f["value"], "-")
			n, err = quantityNumber(strings.TrimPrefix(f["value"], "-"))
			if err == nil && negative {
				n.Neg(n)
			}
		} else {
			n, err = signedNumber(f["value"])
		}
		if err != nil {
			return nil, err
		}
		line, _ := reader.FieldPos(0)
		refs = append(refs, balanceReference{line, kind, id, n})
	}
	if len(refs) == 0 {
		return nil, errors.New("empty_csv")
	}
	return refs, nil
}

// reconcile compares the user's statement with the current corrected journal as
// replayed at asOf. It neither prices positions nor creates/corrects any event.
func reconcile(account, currency string, asOf time.Time, complete bool, refs []balanceReference, book *Book, names map[string]string) (reconciliationReport, error) {
	report := reconciliationReport{Format: "atlas-reconciliation-v1", AccountID: account, Currency: currency, AsOf: asOf.UTC(), CompletePositions: complete, PartialHistory: book.Partial, Rows: []reconciliationRow{}}
	compared := map[string]bool{}
	appendRow := func(line int, kind, id, origin string, expected *big.Rat) {
		actual := zero()
		scale := 8
		if kind == "cash" {
			report.CashChecked = true
			scale = 2
			if book.Cash[account] != nil {
				actual = book.Cash[account]
			}
		} else {
			compared[id] = true
			if p := book.Positions[account][id]; p != nil {
				actual = p.Quantity
			}
		}
		matches := actual.Cmp(expected) == 0
		if !matches {
			report.Differences++
		}
		report.Rows = append(report.Rows, reconciliationRow{Line: line, Kind: kind, AssetID: id, AssetName: names[id], Origin: origin, Expected: value(expected, scale), Actual: value(actual, scale), Delta: value(sub(actual, expected), scale), Matches: matches})
	}
	for _, ref := range refs {
		appendRow(ref.Line, ref.Kind, ref.AssetID, "statement", ref.Number)
	}
	if complete {
		ids := []string{}
		for id, p := range book.Positions[account] {
			if !compared[id] && p.Quantity.Sign() != 0 {
				ids = append(ids, id)
			}
		}
		sort.Strings(ids)
		if len(ids)+len(report.Rows) > 1000 {
			return report, errors.New("reconciliation_result_limit")
		}
		for _, id := range ids {
			appendRow(0, "position", id, "declared_absent", zero())
		}
	}
	return report, nil
}
func (s *Server) previewReconciliation(w http.ResponseWriter, r *http.Request, owner string) {
	var in reconciliationRequest
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		fail(w, 415, "json_required")
		return
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128<<10))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&in) != nil {
		fail(w, 400, "invalid_reconciliation_json")
		return
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF || in.Format != "atlas-balances-v1" {
		fail(w, 400, "balances_format_required")
		return
	}
	at, err := time.Parse(time.RFC3339Nano, in.AsOf)
	if err != nil || at.After(time.Now()) {
		fail(w, 422, "invalid_date")
		return
	}
	refs, err := parseBalances(in.CSV)
	if err != nil {
		fail(w, 422, err.Error())
		return
	}
	tx, err := s.DB.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		dbFail(w, err)
		return
	}
	defer tx.Rollback()
	accounts, err := loadAccounts(r.Context(), tx, owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	account, ok := accounts[in.AccountID]
	if !ok {
		fail(w, 404, "resource_not_available")
		return
	}
	if in.Currency != account.Currency {
		fail(w, 422, "reconciliation_currency_mismatch")
		return
	}
	names := map[string]string{}
	rows, err := tx.QueryContext(r.Context(), "SELECT id,name FROM assets WHERE user_id=$1", owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	for rows.Next() {
		var id, name string
		if err = rows.Scan(&id, &name); err != nil {
			rows.Close()
			dbFail(w, err)
			return
		}
		names[id] = name
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		dbFail(w, err)
		return
	}
	for _, ref := range refs {
		if ref.Kind == "position" {
			if _, ok := names[ref.AssetID]; !ok {
				fail(w, 404, "resource_not_available")
				return
			}
		}
	}
	ops, err := loadOperations(r.Context(), tx, owner, false)
	if err != nil {
		dbFail(w, err)
		return
	}
	book, err := Replay(events(ops, at), accounts)
	if err != nil {
		fail(w, 422, "reconciliation_history_invalid")
		return
	}
	report, err := reconcile(in.AccountID, account.Currency, at, in.CompletePositions, refs, book, names)
	if err != nil {
		fail(w, 422, err.Error())
		return
	}
	report.CalculatedAt = time.Now().UTC()
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, report)
}
