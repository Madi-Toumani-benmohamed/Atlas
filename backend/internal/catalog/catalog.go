// Package catalog owns private portfolio, account and instrument metadata.
// It does not infer balances, holdings, prices, or financial history.
package catalog

import (
	"atlas.local/backend/internal/identity"
	"context"
	"crypto/rand"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
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
	if err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM atlas_schema WHERE version=2)").Scan(&exists); err != nil {
		return err
	}
	if !exists {
		if _, err = tx.ExecContext(ctx, schema); err != nil {
			return err
		}
	}
	return tx.Commit()
}

type Portfolio struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Archived  bool      `json:"archived"`
	CreatedAt time.Time `json:"created_at"`
}
type Account struct {
	ID             string    `json:"id"`
	PortfolioID    string    `json:"portfolio_id"`
	Name           string    `json:"name"`
	Kind           string    `json:"kind"`
	Currency       string    `json:"currency"`
	Provider       string    `json:"provider"`
	SavingsProduct string    `json:"savings_product"`
	Archived       bool      `json:"archived"`
	CreatedAt      time.Time `json:"created_at"`
}
type Asset struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Kind      string    `json:"kind"`
	Symbol    string    `json:"symbol"`
	Namespace string    `json:"namespace"`
	Reference string    `json:"reference"`
	Currency  string    `json:"currency"`
	Archived  bool      `json:"archived"`
	CreatedAt time.Time `json:"created_at"`
}
type Server struct {
	DB   *sql.DB
	Auth *identity.Server
}

func (s *Server) RegisterRoutes(m *http.ServeMux) {
	for pattern, fn := range map[string]func(http.ResponseWriter, *http.Request, string){
		"GET /api/v1/portfolios": s.portfolios, "POST /api/v1/portfolios": s.createPortfolio, "PATCH /api/v1/portfolios/{id}": s.updatePortfolio,
		"GET /api/v1/portfolios/{portfolio}/accounts": s.accounts, "POST /api/v1/portfolios/{portfolio}/accounts": s.createAccount, "PATCH /api/v1/portfolios/{portfolio}/accounts/{id}": s.updateAccount,
		"GET /api/v1/assets": s.assets, "POST /api/v1/assets": s.createAsset, "PATCH /api/v1/assets/{id}": s.updateAsset,
		"GET /api/v1/export": s.export,
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
func fail(w http.ResponseWriter, status int) {
	reply(w, status, map[string]string{"error": http.StatusText(status)})
}
func dbFail(w http.ResponseWriter, err error) {
	var pg *pgconn.PgError
	switch {
	case errors.Is(err, sql.ErrNoRows):
		fail(w, 404)
	case errors.As(err, &pg) && pg.Code == "23505":
		fail(w, 409)
	default:
		fail(w, 503)
	}
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		fail(w, 415)
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		fail(w, 400)
		return false
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		fail(w, 400)
		return false
	}
	return true
}
func text(s string, max int) bool {
	return utf8.ValidString(s) && utf8.RuneCountInString(s) >= 1 && utf8.RuneCountInString(s) <= max && strings.IndexFunc(s, unicode.IsControl) < 0
}
func id() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

var currency = regexp.MustCompile(`^[A-Z]{3}$`)
var mic = regexp.MustCompile(`^[A-Z0-9]{4}$`)
var isin = regexp.MustCompile(`^[A-Z]{2}[A-Z0-9]{9}[0-9]$`)

func validISIN(s string) bool {
	if !isin.MatchString(s) {
		return false
	}
	digits := ""
	for _, c := range s {
		if c >= 'A' && c <= 'Z' {
			digits += strconv.Itoa(int(c-'A') + 10)
		} else {
			digits += string(c)
		}
	}
	sum := 0
	double := false
	for i := len(digits) - 1; i >= 0; i-- {
		n := int(digits[i] - '0')
		if double {
			n *= 2
			if n > 9 {
				n -= 9
			}
		}
		sum += n
		double = !double
	}
	return sum%10 == 0
}
func page(w http.ResponseWriter, r *http.Request) (int, string, bool) {
	n := 100
	var err error
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err = strconv.Atoi(raw)
	}
	cursor := r.URL.Query().Get("cursor")
	if err != nil || n < 1 || n > 100 || len(cursor) > 64 {
		fail(w, 400)
		return 0, "", false
	}
	return n, cursor, true
}
func sendPage[T any](w http.ResponseWriter, items []T, n int, getID func(T) string) {
	next := ""
	if len(items) > n {
		items = items[:n]
		next = getID(items[n-1])
	}
	reply(w, 200, map[string]any{"items": items, "next_cursor": next})
}
func (s *Server) portfolios(w http.ResponseWriter, r *http.Request, owner string) {
	n, cursor, ok := page(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.QueryContext(r.Context(), "SELECT id,name,archived,created_at FROM portfolios WHERE user_id=$1 AND id>$2 ORDER BY id LIMIT $3", owner, cursor, n+1)
	if err != nil {
		dbFail(w, err)
		return
	}
	defer rows.Close()
	out := []Portfolio{}
	for rows.Next() {
		var p Portfolio
		if err = rows.Scan(&p.ID, &p.Name, &p.Archived, &p.CreatedAt); err != nil {
			dbFail(w, err)
			return
		}
		out = append(out, p)
	}
	if rows.Err() != nil {
		dbFail(w, rows.Err())
		return
	}
	sendPage(w, out, n, func(p Portfolio) string { return p.ID })
}
func (s *Server) createPortfolio(w http.ResponseWriter, r *http.Request, owner string) {
	var in struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if !text(in.Name, 120) {
		fail(w, 400)
		return
	}
	p := Portfolio{ID: id(), Name: in.Name}
	err := s.DB.QueryRowContext(r.Context(), "INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,$3) RETURNING created_at", p.ID, owner, p.Name).Scan(&p.CreatedAt)
	if err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 201, p)
}

// Updates replace editable metadata only. Identity, type and currency stay stable.
type update struct {
	Name     *string `json:"name"`
	Archived *bool   `json:"archived"`
}

func (u *update) valid() bool {
	if u.Name != nil {
		v := strings.TrimSpace(*u.Name)
		u.Name = &v
		if !text(v, 120) {
			return false
		}
	}
	return u.Name != nil || u.Archived != nil
}
func (s *Server) updatePortfolio(w http.ResponseWriter, r *http.Request, owner string) {
	var in update
	if !decode(w, r, &in) {
		return
	}
	if !in.valid() {
		fail(w, 400)
		return
	}
	var p Portfolio
	err := s.DB.QueryRowContext(r.Context(), "UPDATE portfolios SET name=COALESCE($1,name),archived=COALESCE($2,archived) WHERE id=$3 AND user_id=$4 RETURNING id,name,archived,created_at", in.Name, in.Archived, r.PathValue("id"), owner).Scan(&p.ID, &p.Name, &p.Archived, &p.CreatedAt)
	if err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, p)
}
func (s *Server) accounts(w http.ResponseWriter, r *http.Request, owner string) {
	n, cursor, ok := page(w, r)
	if !ok {
		return
	}
	var exists bool
	err := s.DB.QueryRowContext(r.Context(), "SELECT EXISTS(SELECT 1 FROM portfolios WHERE id=$1 AND user_id=$2)", r.PathValue("portfolio"), owner).Scan(&exists)
	if err != nil {
		dbFail(w, err)
		return
	}
	if !exists {
		fail(w, 404)
		return
	}
	rows, err := s.DB.QueryContext(r.Context(), "SELECT id,portfolio_id,name,kind,currency,provider,savings_product,archived,created_at FROM accounts WHERE user_id=$1 AND portfolio_id=$2 AND id>$3 ORDER BY id LIMIT $4", owner, r.PathValue("portfolio"), cursor, n+1)
	if err != nil {
		dbFail(w, err)
		return
	}
	defer rows.Close()
	out := []Account{}
	for rows.Next() {
		var a Account
		if err = rows.Scan(&a.ID, &a.PortfolioID, &a.Name, &a.Kind, &a.Currency, &a.Provider, &a.SavingsProduct, &a.Archived, &a.CreatedAt); err != nil {
			dbFail(w, err)
			return
		}
		out = append(out, a)
	}
	if rows.Err() != nil {
		dbFail(w, rows.Err())
		return
	}
	sendPage(w, out, n, func(a Account) string { return a.ID })
}
func (s *Server) createAccount(w http.ResponseWriter, r *http.Request, owner string) {
	var in struct {
		Name           string `json:"name"`
		Kind           string `json:"kind"`
		Currency       string `json:"currency"`
		Provider       string `json:"provider"`
		SavingsProduct string `json:"savings_product"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Provider = strings.TrimSpace(in.Provider)
	if !text(in.Name, 120) || !currency.MatchString(in.Currency) || (in.Provider != "" && !text(in.Provider, 120)) || (in.Kind != "brokerage" && in.Kind != "crypto" && in.Kind != "savings") || (in.Kind == "savings" && (in.SavingsProduct != "livret_a" && in.SavingsProduct != "pel" && in.SavingsProduct != "other")) || (in.Kind != "savings" && in.SavingsProduct != "") || ((in.SavingsProduct == "livret_a" || in.SavingsProduct == "pel") && in.Currency != "EUR") {
		fail(w, 400)
		return
	}
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		dbFail(w, err)
		return
	}
	defer tx.Rollback()
	// Match the ledger's owner-before-resource lock order to avoid FK deadlocks.
	if _, err = tx.ExecContext(r.Context(), "SELECT id FROM users WHERE id=$1 FOR KEY SHARE", owner); err != nil {
		dbFail(w, err)
		return
	}

	var archived bool
	err = tx.QueryRowContext(r.Context(), "SELECT archived FROM portfolios WHERE id=$1 AND user_id=$2 FOR UPDATE", r.PathValue("portfolio"), owner).Scan(&archived)
	if err != nil {
		dbFail(w, err)
		return
	}
	if archived {
		fail(w, 409)
		return
	}
	a := Account{ID: id(), PortfolioID: r.PathValue("portfolio"), Name: in.Name, Kind: in.Kind, Currency: in.Currency, Provider: in.Provider, SavingsProduct: in.SavingsProduct}
	err = tx.QueryRowContext(r.Context(), "INSERT INTO accounts(id,user_id,portfolio_id,name,kind,currency,provider,savings_product) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING created_at", a.ID, owner, a.PortfolioID, a.Name, a.Kind, a.Currency, a.Provider, a.SavingsProduct).Scan(&a.CreatedAt)
	if err != nil {
		dbFail(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 201, a)
}
func (s *Server) updateAccount(w http.ResponseWriter, r *http.Request, owner string) {
	var in update
	if !decode(w, r, &in) {
		return
	}
	if !in.valid() {
		fail(w, 400)
		return
	}
	var a Account
	err := s.DB.QueryRowContext(r.Context(), "UPDATE accounts SET name=COALESCE($1,name),archived=COALESCE($2,archived) WHERE id=$3 AND user_id=$4 AND portfolio_id=$5 RETURNING id,portfolio_id,name,kind,currency,provider,savings_product,archived,created_at", in.Name, in.Archived, r.PathValue("id"), owner, r.PathValue("portfolio")).Scan(&a.ID, &a.PortfolioID, &a.Name, &a.Kind, &a.Currency, &a.Provider, &a.SavingsProduct, &a.Archived, &a.CreatedAt)
	if err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, a)
}
func (s *Server) assets(w http.ResponseWriter, r *http.Request, owner string) {
	n, cursor, ok := page(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.QueryContext(r.Context(), "SELECT id,name,kind,symbol,namespace,reference,currency,archived,created_at FROM assets WHERE user_id=$1 AND id>$2 ORDER BY id LIMIT $3", owner, cursor, n+1)
	if err != nil {
		dbFail(w, err)
		return
	}
	defer rows.Close()
	out := []Asset{}
	for rows.Next() {
		var a Asset
		if err = rows.Scan(&a.ID, &a.Name, &a.Kind, &a.Symbol, &a.Namespace, &a.Reference, &a.Currency, &a.Archived, &a.CreatedAt); err != nil {
			dbFail(w, err)
			return
		}
		out = append(out, a)
	}
	if rows.Err() != nil {
		dbFail(w, rows.Err())
		return
	}
	sendPage(w, out, n, func(a Asset) string { return a.ID })
}
func (s *Server) createAsset(w http.ResponseWriter, r *http.Request, owner string) {
	var in struct {
		Name      string `json:"name"`
		Kind      string `json:"kind"`
		Symbol    string `json:"symbol"`
		Namespace string `json:"namespace"`
		Reference string `json:"reference"`
		Currency  string `json:"currency"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Symbol = strings.TrimSpace(in.Symbol)
	in.Namespace = strings.TrimSpace(in.Namespace)
	in.Reference = strings.TrimSpace(in.Reference)
	if !text(in.Name, 120) || !text(in.Symbol, 30) || !text(in.Namespace, 80) || !text(in.Reference, 160) || !currency.MatchString(in.Currency) || (in.Kind != "stock" && in.Kind != "etf" && in.Kind != "crypto" && in.Kind != "stablecoin") || ((in.Kind == "stock" || in.Kind == "etf") && (!mic.MatchString(in.Namespace) || !validISIN(in.Reference))) {
		fail(w, 400)
		return
	}
	a := Asset{ID: id(), Name: in.Name, Kind: in.Kind, Symbol: in.Symbol, Namespace: in.Namespace, Reference: in.Reference, Currency: in.Currency}
	err := s.DB.QueryRowContext(r.Context(), "INSERT INTO assets(id,user_id,name,kind,symbol,namespace,reference,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING created_at", a.ID, owner, a.Name, a.Kind, a.Symbol, a.Namespace, a.Reference, a.Currency).Scan(&a.CreatedAt)
	if err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 201, a)
}
func (s *Server) updateAsset(w http.ResponseWriter, r *http.Request, owner string) {
	var in update
	if !decode(w, r, &in) {
		return
	}
	if !in.valid() {
		fail(w, 400)
		return
	}
	var a Asset
	err := s.DB.QueryRowContext(r.Context(), "UPDATE assets SET name=COALESCE($1,name),archived=COALESCE($2,archived) WHERE id=$3 AND user_id=$4 RETURNING id,name,kind,symbol,namespace,reference,currency,archived,created_at", in.Name, in.Archived, r.PathValue("id"), owner).Scan(&a.ID, &a.Name, &a.Kind, &a.Symbol, &a.Namespace, &a.Reference, &a.Currency, &a.Archived, &a.CreatedAt)
	if err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, a)
}
