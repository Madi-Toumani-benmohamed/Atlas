package ledger

import (
	"database/sql"
	_ "embed"
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

//go:embed import-schema.sql
var importSchema string

type ImportRow struct {
	Line       int    `json:"line"`
	ExternalID string `json:"external_id"`
	Event      Event  `json:"event"`
	Error      string `json:"error,omitempty"`
	Duplicate  bool   `json:"duplicate"`
}

func csvKey(row ImportRow) string {
	return "csv:" + hash([]byte(row.Event.AccountID+":"+row.ExternalID))
}
func csvHash(row ImportRow) string { raw, _ := json.Marshal(row.Event); return hash(raw) }
func parseCSV(raw string) ([]ImportRow, error) {
	if !utf8.ValidString(raw) {
		return nil, errors.New("csv_must_be_utf8")
	}
	reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(raw, "\ufeff")))
	header, err := reader.Read()
	if err != nil {
		return nil, errors.New("csv_header_required")
	}
	allowed := map[string]bool{}
	for _, name := range []string{"external_id", "kind", "account_id", "target_account_id", "asset_id", "occurred_at", "quantity", "price", "amount", "fees", "cost", "price_source", "price_observed_at", "fx_to_eur", "fx_source", "fx_observed_at", "exchange_rate", "note"} {
		allowed[name] = true
	}
	seen := map[string]bool{}
	for _, name := range header {
		if !allowed[name] || seen[name] {
			return nil, errors.New("unsupported_or_duplicate_csv_column")
		}
		seen[name] = true
	}
	for _, required := range []string{"external_id", "kind", "account_id", "occurred_at"} {
		if !seen[required] {
			return nil, errors.New("missing_csv_column")
		}
	}
	rows := []ImportRow{}
	keys := map[string]bool{}
	for line := 2; ; line++ {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, errors.New("invalid_csv_row")
		}
		if len(rows) >= 500 {
			return nil, errors.New("csv_batch_limit_500")
		}
		fields := map[string]string{}
		for i, v := range record {
			fields[header[i]] = v
		}
		external := fields["external_id"]
		delete(fields, "external_id")
		data, _ := json.Marshal(fields)
		var e Event
		if err = json.Unmarshal(data, &e); err != nil {
			return nil, err
		}
		row := ImportRow{Line: line, ExternalID: external, Event: e}
		if !text(external, 160) {
			row.Error = "external_id_required"
		} else if err = normalize(&row.Event); err != nil {
			row.Error = err.Error()
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
func (s *Server) previewImport(w http.ResponseWriter, r *http.Request, owner string) {
	var in importRequest
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		fail(w, 415, "json_required")
		return
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	d.DisallowUnknownFields()
	if d.Decode(&in) != nil {
		fail(w, 400, "invalid_import_json")
		return
	}
	var extra any
	if d.Decode(&extra) != io.EOF || (in.Format != "atlas-csv-v1" && in.Format != "coinbase-transactions-v1" && in.Format != "trade-republic-transactions-v1") {
		fail(w, 400, "unsupported_import_format")
		return
	}
	var rows []ImportRow
	var err error
	if in.Format == "atlas-csv-v1" {
		rows, err = parseCSV(in.CSV)
	} else {
		rows, err = parseBroker(in)
	}
	if err != nil {
		fail(w, 422, err.Error())
		return
	}
	tx, err := s.DB.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelRepeatableRead})
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
	if in.Format != "atlas-csv-v1" {
		account, ok := accounts[in.AccountID]
		if !ok || account.Archived {
			fail(w, 422, "resource_not_available")
			return
		}
		if account.Currency != "EUR" {
			fail(w, 422, "broker_eur_only")
			return
		}
	}
	ops, err := loadOperations(r.Context(), tx, owner, false)
	if err != nil {
		dbFail(w, err)
		return
	}
	es := events(ops, time.Now())
	var order int64
	for _, e := range es {
		if e.Order > order {
			order = e.Order
		}
	}
	valid := true
	for i := range rows {
		row := &rows[i]
		if row.Error != "" {
			valid = false
			continue
		}
		if err = validateMetadata(r.Context(), tx, owner, row.Event, false); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				row.Error = "resource_not_available"
			} else {
				row.Error = err.Error()
			}
			valid = false
			continue
		}
		var existing string
		err = tx.QueryRowContext(r.Context(), "SELECT request_hash FROM operations WHERE user_id=$1 AND idempotency_key=$2", owner, csvKey(*row)).Scan(&existing)
		if err == nil {
			if existing == csvHash(*row) {
				row.Duplicate = true
			} else {
				row.Error = "external_id_conflict"
				valid = false
			}
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			dbFail(w, err)
			return
		}
		e := row.Event
		order++
		e.Order = order
		es = append(es, e)
	}
	validation := ""
	if valid {
		if _, err = Replay(es, accounts); err != nil {
			validation = err.Error()
			valid = false
		}
	}
	stored, _ := json.Marshal(rows)
	batchID := token()
	var confirmed bool
	err = tx.QueryRowContext(r.Context(), "INSERT INTO import_batches(id,user_id,fingerprint,rows) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,fingerprint) DO UPDATE SET fingerprint=EXCLUDED.fingerprint, rows=CASE WHEN import_batches.confirmed THEN import_batches.rows ELSE EXCLUDED.rows END RETURNING id,confirmed", batchID, owner, importFingerprint(in), stored).Scan(&batchID, &confirmed)
	if err != nil {
		dbFail(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, map[string]any{"id": batchID, "rows": rows, "can_confirm": valid, "validation_error": validation, "confirmed": confirmed, "format": in.Format})
}
func (s *Server) confirmImport(w http.ResponseWriter, r *http.Request, owner string) {
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		dbFail(w, err)
		return
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), "SELECT id FROM users WHERE id=$1 FOR UPDATE", owner); err != nil {
		dbFail(w, err)
		return
	}
	var raw []byte
	var confirmed bool
	err = tx.QueryRowContext(r.Context(), "SELECT rows,confirmed FROM import_batches WHERE id=$1 AND user_id=$2 FOR UPDATE", r.PathValue("id"), owner).Scan(&raw, &confirmed)
	if err != nil {
		dbFail(w, err)
		return
	}
	if confirmed {
		reply(w, 200, map[string]any{"status": "already_confirmed", "accepted": 0})
		return
	}
	var rows []ImportRow
	if json.Unmarshal(raw, &rows) != nil {
		fail(w, 503, "invalid_stored_batch")
		return
	}
	accepted, duplicates := 0, 0
	for _, row := range rows {
		if row.Error != "" {
			fail(w, 422, "batch_contains_errors")
			return
		}
		if err = validateMetadata(r.Context(), tx, owner, row.Event, false); err != nil {
			writeFail(w, err)
			return
		}
		var previous string
		err = tx.QueryRowContext(r.Context(), "SELECT request_hash FROM operations WHERE user_id=$1 AND idempotency_key=$2", owner, csvKey(row)).Scan(&previous)
		if err == nil {
			if previous != csvHash(row) {
				fail(w, 409, "external_id_conflict")
				return
			}
			duplicates++
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			dbFail(w, err)
			return
		}
		payload, _ := json.Marshal(row.Event)
		id := token()
		var sequence int64
		err = tx.QueryRowContext(r.Context(), "INSERT INTO operations(id,user_id,account_id,target_account_id,asset_id,payload,idempotency_key,request_hash) VALUES($1,$2,$3,NULLIF($4,''),NULLIF($5,''),$6,$7,$8) RETURNING sequence", id, owner, row.Event.AccountID, row.Event.TargetID, row.Event.AssetID, payload, csvKey(row), csvHash(row)).Scan(&sequence)
		if err != nil {
			dbFail(w, err)
			return
		}
		if _, err = tx.ExecContext(r.Context(), "UPDATE operations SET logical_order=$1 WHERE id=$2", sequence, id); err != nil {
			dbFail(w, err)
			return
		}
		accepted++
	}
	accounts, err := loadAccounts(r.Context(), tx, owner)
	if err != nil {
		dbFail(w, err)
		return
	}
	ops, err := loadOperations(r.Context(), tx, owner, false)
	if err != nil {
		dbFail(w, err)
		return
	}
	if _, err = Replay(events(ops, time.Now()), accounts); err != nil {
		fail(w, 422, err.Error())
		return
	}
	if _, err = tx.ExecContext(r.Context(), "UPDATE import_batches SET confirmed=true WHERE id=$1 AND user_id=$2", r.PathValue("id"), owner); err != nil {
		dbFail(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, map[string]any{"status": "confirmed", "accepted": accepted, "duplicates": duplicates})
}

func importFingerprint(in importRequest) string {
	if in.Format == "atlas-csv-v1" {
		return hash([]byte(in.CSV))
	}
	raw, _ := json.Marshal(in)
	return hash(raw)
}
