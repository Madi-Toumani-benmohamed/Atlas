package identity

import (
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
	"net/mail"
	"strings"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

//go:embed schema.sql
var schema string

// Migrate applies the initial schema atomically, serialized across processes.
func Migrate(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(71620501)"); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, schema); err != nil {
		return err
	}
	return tx.Commit()
}

type Server struct {
	DB           *sql.DB
	Origin       string
	Secure       bool
	Registration bool
	mu           sync.Mutex
	attempts     int
	window       time.Time
	dummy        []byte
}

func New(db *sql.DB, origin string, secure, registration bool) *Server {
	dummy, _ := bcrypt.GenerateFromPassword([]byte(randomToken()), 12)
	return &Server{DB: db, Origin: origin, Secure: secure, Registration: registration, dummy: dummy}
}

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func digest(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func reply(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, status int) {
	reply(w, status, map[string]string{"error": http.StatusText(status)})
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/auth/register", s.guard(s.register, true))
	mux.HandleFunc("POST /api/v1/auth/login", s.guard(s.login, true))
	mux.HandleFunc("POST /api/v1/auth/logout", s.guard(s.logout, false))
	mux.HandleFunc("GET /api/v1/me", s.me)
}

// A conservative instance-wide limit also bounds expensive password hashing.
// No proxy headers are trusted and no IP/user identifiers are retained.
func (s *Server) guard(next http.HandlerFunc, limited bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") != s.Origin || r.Header.Get("Sec-Fetch-Site") == "cross-site" {
			fail(w, 403)
			return
		}
		if limited {
			s.mu.Lock()
			if time.Since(s.window) >= time.Minute {
				s.window = time.Now()
				s.attempts = 0
			}
			allowed := s.attempts < 20
			if allowed {
				s.attempts++
			}
			s.mu.Unlock()
			if !allowed {
				w.Header().Set("Retry-After", "60")
				fail(w, 429)
				return
			}
		}
		next(w, r)
	}
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func readCredentials(w http.ResponseWriter, r *http.Request) (credentials, bool) {
	var c credentials
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		fail(w, 415)
		return c, false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(&c) != nil {
		fail(w, 400)
		return c, false
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		fail(w, 400)
		return c, false
	}
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
	a, err := mail.ParseAddress(c.Email)
	if err != nil || a.Address != c.Email || len(c.Email) > 254 || len(c.Password) < 12 || len(c.Password) > 72 {
		fail(w, 400)
		return c, false
	}
	return c, true
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	if !s.Registration {
		fail(w, 403)
		return
	}
	c, ok := readCredentials(w, r)
	if !ok {
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(c.Password), 12)
	if err != nil {
		fail(w, 500)
		return
	}
	// Generic response conceals whether an email was already registered.
	_, err = s.DB.ExecContext(r.Context(), "INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING", randomToken(), c.Email, string(hash))
	if err != nil {
		fail(w, 503)
		return
	}
	reply(w, 202, map[string]string{"status": "accepted"})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	c, ok := readCredentials(w, r)
	if !ok {
		return
	}
	var id, hash string
	err := s.DB.QueryRowContext(r.Context(), "SELECT id,password_hash FROM users WHERE email=$1", c.Email).Scan(&id, &hash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fail(w, 503)
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		bcrypt.CompareHashAndPassword(s.dummy, []byte(c.Password))
		fail(w, 401)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password)) != nil {
		fail(w, 401)
		return
	}
	token := randomToken()
	expiry := time.Now().Add(12 * time.Hour)
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		fail(w, 503)
		return
	}
	defer tx.Rollback()
	// Serialize simultaneous logins so exactly one session remains valid.
	if _, err = tx.ExecContext(r.Context(), "SELECT id FROM users WHERE id=$1 FOR UPDATE", id); err != nil {
		fail(w, 503)
		return
	}
	// Each successful login rotates all this user's sessions.
	if _, err = tx.ExecContext(r.Context(), "DELETE FROM sessions WHERE user_id=$1 OR expires_at<=now()", id); err != nil {
		fail(w, 503)
		return
	}
	if _, err = tx.ExecContext(r.Context(), "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)", digest(token), id, expiry); err != nil {
		fail(w, 503)
		return
	}
	if tx.Commit() != nil {
		fail(w, 503)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "atlas_session", Value: token, Path: "/", HttpOnly: true, Secure: s.Secure, SameSite: http.SameSiteStrictMode, MaxAge: 43200, Expires: expiry})
	reply(w, 200, map[string]string{"status": "authenticated"})
}
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("atlas_session")
	if err != nil || len(c.Value) != 64 {
		fail(w, 401)
		return
	}
	var id, email string
	err = s.DB.QueryRowContext(r.Context(), "SELECT u.id,u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()", digest(c.Value)).Scan(&id, &email)
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, 401)
		return
	}
	if err != nil {
		fail(w, 503)
		return
	}
	reply(w, 200, map[string]string{"id": id, "email": email})
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("atlas_session"); err == nil {
		if _, err = s.DB.ExecContext(r.Context(), "DELETE FROM sessions WHERE token_hash=$1", digest(c.Value)); err != nil {
			fail(w, 503)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "atlas_session", Value: "", Path: "/", HttpOnly: true, Secure: s.Secure, SameSite: http.SameSiteStrictMode, MaxAge: -1})
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(204)
}
