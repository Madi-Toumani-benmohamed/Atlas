package ledger

import (
	"atlas.local/backend/internal/identity"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

//go:embed schema.sql
var schema string

func Migrate(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(71620501)"); err != nil {
		return err
	}
	var exists bool
	if err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM atlas_schema WHERE version=3)").Scan(&exists); err != nil {
		return err
	}
	if !exists {
		if _, err = tx.ExecContext(ctx, schema); err != nil {
			return err
		}
	}
	if err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM atlas_schema WHERE version=4)").Scan(&exists); err != nil {
		return err
	}
	if !exists {
		if _, err = tx.ExecContext(ctx, importSchema); err != nil {
			return err
		}
	}
	if err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM atlas_schema WHERE version=5)").Scan(&exists); err != nil {
		return err
	}
	if !exists {
		if _, err = tx.ExecContext(ctx, marketSchema); err != nil {
			return err
		}
	}
	return tx.Commit()
}

type Server struct {
	DB   *sql.DB
	Auth *identity.Server
	ECB  *ECBProvider
}
type Operation struct {
	Event
	Active    bool      `json:"active"`
	Corrects  string    `json:"corrects,omitempty"`
	Reason    string    `json:"reason,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Server) RegisterRoutes(m *http.ServeMux) {
	if s.ECB == nil {
		s.ECB = &ECBProvider{}
	}
	for pattern, fn := range map[string]func(http.ResponseWriter, *http.Request, string){
		"POST /api/v1/operations": s.create, "GET /api/v1/operations": s.history, "POST /api/v1/operations/{id}/corrections": s.correct,
		"POST /api/v1/prices": s.createPrice, "GET /api/v1/prices": s.prices, "GET /api/v1/summary": s.summary,
		"POST /api/v1/market/fx/refresh": s.refreshFX,
		"GET /api/v1/market/status":      s.marketStatus,
		"GET /api/v1/history":            s.timeline, "GET /api/v1/financial-export": s.export,
		"POST /api/v1/reconciliations/preview": s.previewReconciliation,
		"POST /api/v1/imports/preview":         s.previewImport, "POST /api/v1/imports/{id}/confirm": s.confirmImport,
	} {
		m.HandleFunc(pattern, s.Auth.WithUser(fn))
	}
}
func reply(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, code string) {
	reply(w, status, map[string]string{"error": code})
}
func dbFail(w http.ResponseWriter, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, 404, "not_found")
	} else {
		fail(w, 503, "storage_unavailable")
	}
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		fail(w, 415, "json_required")
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16384))
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		fail(w, 400, "invalid_json")
		return false
	}
	var more any
	if d.Decode(&more) != io.EOF {
		fail(w, 400, "invalid_json")
		return false
	}
	return true
}
func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func hash(raw []byte) string { v := sha256.Sum256(raw); return hex.EncodeToString(v[:]) }
func text(v string, n int) bool {
	return utf8.ValidString(v) && len(strings.TrimSpace(v)) > 0 && utf8.RuneCountInString(v) <= n && strings.IndexFunc(v, unicode.IsControl) < 0
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func loadOperations(ctx context.Context, q queryer, owner string, all bool) ([]Operation, error) {
	rows, err := q.QueryContext(ctx, "SELECT id,payload,logical_order,active,COALESCE(corrects,''),reason,created_at FROM operations WHERE user_id=$1 AND ($2 OR active) ORDER BY sequence", owner, all)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Operation{}
	for rows.Next() {
		var o Operation
		var raw []byte
		var id string
		var order int64
		if err = rows.Scan(&id, &raw, &order, &o.Active, &o.Corrects, &o.Reason, &o.CreatedAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &o.Event); err != nil {
			return nil, err
		}
		o.ID = id
		o.Order = order
		out = append(out, o)
	}
	return out, rows.Err()
}
func loadAccounts(ctx context.Context, q queryer, owner string) (map[string]Account, error) {
	rows, err := q.QueryContext(ctx, "SELECT a.id,a.currency,(a.archived OR p.archived) FROM accounts a JOIN portfolios p ON p.id=a.portfolio_id AND p.user_id=a.user_id WHERE a.user_id=$1", owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]Account{}
	for rows.Next() {
		var id string
		var a Account
		if err = rows.Scan(&id, &a.Currency, &a.Archived); err != nil {
			return nil, err
		}
		out[id] = a
	}
	return out, rows.Err()
}
func events(ops []Operation, at time.Time) []Event {
	out := []Event{}
	for _, o := range ops {
		t, _ := time.Parse(time.RFC3339Nano, o.At)
		if o.Active && !t.After(at) {
			out = append(out, o.Event)
		}
	}
	return out
}
func normalize(e *Event) error {
	if e.ID != "" || e.Order != 0 {
		return errors.New("server_owned_id")
	}
	if len(e.Note) > 1000 || strings.ContainsRune(e.Note, 0) {
		return errors.New("note_too_long")
	}
	if e.PriceSource != "" && !text(e.PriceSource, 120) || e.FXSource != "" && !text(e.FXSource, 120) {
		return errors.New("invalid_source")
	}
	if err := Check(*e); err != nil {
		return err
	}
	t, _ := time.Parse(time.RFC3339Nano, e.At)
	e.At = t.UTC().Format(time.RFC3339Nano)
	return nil
}
func (s *Server) create(w http.ResponseWriter, r *http.Request, owner string) {
	var e Event
	if !decode(w, r, &e) {
		return
	}
	if err := normalize(&e); err != nil {
		fail(w, 422, err.Error())
		return
	}
	s.store(w, r, owner, e, "", "", false)
}
func (s *Server) correct(w http.ResponseWriter, r *http.Request, owner string) {
	var in struct {
		Replacement *Event `json:"replacement"`
		Reason      string `json:"reason"`
		Void        bool   `json:"void"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !text(in.Reason, 500) || (in.Void == (in.Replacement != nil)) {
		fail(w, 400, "correction_requires_reason_and_replacement_or_void")
		return
	}
	var e Event
	if in.Replacement != nil {
		e = *in.Replacement
		if err := normalize(&e); err != nil {
			fail(w, 422, err.Error())
			return
		}
	}
	s.store(w, r, owner, e, r.PathValue("id"), in.Reason, in.Void)
}

func (s *Server) store(w http.ResponseWriter, r *http.Request, owner string, e Event, corrects, reason string, void bool) {
	key := r.Header.Get("Idempotency-Key")
	if !text(key, 120) || len(key) < 12 {
		fail(w, 400, "idempotency_key_required")
		return
	}
	canonical, _ := json.Marshal(struct {
		Event            Event
		Corrects, Reason string
		Void             bool
	}{e, corrects, reason, void})
	fingerprint := hash(canonical)
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
	var previousID, previousHash string
	err = tx.QueryRowContext(r.Context(), "SELECT id,request_hash FROM operations WHERE user_id=$1 AND idempotency_key=$2", owner, key).Scan(&previousID, &previousHash)
	if err == nil {
		if previousHash != fingerprint {
			fail(w, 409, "idempotency_conflict")
			return
		}
		reply(w, 200, map[string]string{"id": previousID, "status": "already_recorded"})
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		dbFail(w, err)
		return
	}
	var order int64
	if corrects != "" {
		var raw []byte
		err = tx.QueryRowContext(r.Context(), "SELECT payload,logical_order FROM operations WHERE id=$1 AND user_id=$2 AND active FOR UPDATE", corrects, owner).Scan(&raw, &order)
		if err != nil {
			dbFail(w, err)
			return
		}
		if void {
			if err = json.Unmarshal(raw, &e); err != nil {
				dbFail(w, err)
				return
			}
		}
		if _, err = tx.ExecContext(r.Context(), "UPDATE operations SET active=false WHERE id=$1 AND user_id=$2", corrects, owner); err != nil {
			dbFail(w, err)
			return
		}
	}
	if err = validateMetadata(r.Context(), tx, owner, e, void); err != nil {
		writeFail(w, err)
		return
	}
	raw, _ := json.Marshal(e)
	newID := token()
	var sequence int64
	err = tx.QueryRowContext(r.Context(), "INSERT INTO operations(id,user_id,account_id,target_account_id,asset_id,payload,active,corrects,reason,idempotency_key,request_hash) VALUES($1,$2,$3,NULLIF($4,''),NULLIF($5,''),$6,$7,NULLIF($8,''),$9,$10,$11) RETURNING sequence", newID, owner, e.AccountID, e.TargetID, e.AssetID, raw, !void, corrects, reason, key, fingerprint).Scan(&sequence)
	if err != nil {
		dbFail(w, err)
		return
	}
	if order == 0 {
		order = sequence
	}
	if _, err = tx.ExecContext(r.Context(), "UPDATE operations SET logical_order=$1 WHERE id=$2", order, newID); err != nil {
		dbFail(w, err)
		return
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
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	e.ID = newID
	e.Order = order
	reply(w, 201, Operation{Event: e, Active: !void, Corrects: corrects, Reason: reason, CreatedAt: time.Now().UTC()})
}
func (s *Server) history(w http.ResponseWriter, r *http.Request, owner string) {
	ops, err := loadOperations(r.Context(), s.DB, owner, true)
	if err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, map[string]any{"items": ops})
}

type writeError struct {
	status int
	code   string
}

func (e *writeError) Error() string { return e.code }
func writeFail(w http.ResponseWriter, err error) {
	var v *writeError
	if errors.As(err, &v) {
		fail(w, v.status, v.code)
	} else {
		dbFail(w, err)
	}
}
func validateMetadata(ctx context.Context, tx *sql.Tx, owner string, e Event, void bool) error {
	// Locks prevent metadata from being archived during this financial write.
	for _, accountID := range []string{e.AccountID, e.TargetID} {
		if accountID == "" {
			continue
		}
		var archived bool
		var kind string
		err := tx.QueryRowContext(ctx, "SELECT a.archived OR p.archived,a.kind FROM accounts a JOIN portfolios p ON p.id=a.portfolio_id AND p.user_id=a.user_id WHERE a.id=$1 AND a.user_id=$2 FOR SHARE OF a,p", accountID, owner).Scan(&archived, &kind)
		if err != nil {
			return err
		}
		if archived && !void {
			return &writeError{409, "account_archived"}
		}
		if !void && ((kind == "savings" && e.AssetID != "") || (e.Kind == "interest" && kind != "savings")) {
			return &writeError{422, "account_type_mismatch"}
		}
	}
	if e.AssetID != "" {
		var archived bool
		var kind string
		err := tx.QueryRowContext(ctx, "SELECT archived,kind FROM assets WHERE id=$1 AND user_id=$2 FOR SHARE", e.AssetID, owner).Scan(&archived, &kind)
		if err != nil {
			return err
		}
		if archived && !void {
			return &writeError{409, "asset_archived"}
		}
		if e.Kind == "staking" && kind != "crypto" && kind != "stablecoin" {
			return &writeError{422, "staking_requires_crypto"}
		}
	}

	return nil
}
