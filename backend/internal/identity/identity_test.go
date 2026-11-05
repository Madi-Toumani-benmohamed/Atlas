package identity

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestIntegration(t *testing.T) {
	dsn := os.Getenv("ATLAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = Migrate(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if err = Migrate(context.Background(), db); err != nil {
		t.Fatal("migration replay", err)
	}
	s := New(db, "https://atlas.test", true, true)
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	request := func(method, path, body, origin string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("status %d want %d: %s", w.Code, status, w.Body.String())
		}
	}
	origin := "https://atlas.test"
	creds := func(email string) string { return `{"email":"` + email + `","password":"synthetic-test-password"}` }
	a := randomToken() + "@example.test"
	b := randomToken() + "@example.test"
	for _, email := range []string{a, b} {
		check(request("POST", "/api/v1/auth/register", creds(email), origin, nil), 202)
	}
	check(request("POST", "/api/v1/auth/register", creds(a), origin, nil), 202)
	check(request("POST", "/api/v1/auth/login", creds(a), "https://evil.test", nil), 403)
	check(request("POST", "/api/v1/auth/login", `{"email":"`+a+`","password":"wrong-password"}`, origin, nil), 401)
	login := func(email string) *http.Cookie {
		w := request("POST", "/api/v1/auth/login", creds(email), origin, nil)
		check(w, 200)
		c := w.Result().Cookies()[0]
		if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteStrictMode {
			t.Fatal("unsafe cookie")
		}
		return c
	}
	ca, cb := login(a), login(b)
	for _, tc := range []struct {
		cookie *http.Cookie
		email  string
	}{{ca, a}, {cb, b}} {
		w := request("GET", "/api/v1/me?user_id=other", "", "", tc.cookie)
		check(w, 200)
		var got map[string]string
		json.Unmarshal(w.Body.Bytes(), &got)
		if got["email"] != tc.email {
			t.Fatal("cross-user leak")
		}
	}
	check(request("GET", "/api/v1/me", "", "", nil), 401)
	check(request("GET", "/api/v1/me", "", "", &http.Cookie{Name: "atlas_session", Value: strings.Repeat("0", 64)}), 401)
	rotated := login(a)
	check(request("GET", "/api/v1/me", "", "", ca), 401)
	check(request("POST", "/api/v1/auth/logout", "", origin, rotated), 204)
	check(request("GET", "/api/v1/me", "", "", rotated), 401)
	if _, err = db.Exec("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", digest(cb.Value)); err != nil {
		t.Fatal(err)
	}
	check(request("GET", "/api/v1/me", "", "", cb), 401)
	s.Registration = false
	check(request("POST", "/api/v1/auth/register", creds(a), origin, nil), 403)
	s.mu.Lock()
	s.attempts = 20
	s.mu.Unlock()
	check(request("POST", "/api/v1/auth/login", creds(a), origin, nil), 429)
}

func TestInputAndOrigin(t *testing.T) {
	s := &Server{Origin: "https://atlas.test", Registration: true}
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	for _, tc := range []struct {
		name, body, origin, content string
		status                      int
	}{
		{"missing origin", `{}`, "", "application/json", 403},
		{"foreign origin", `{}`, "https://evil.test", "application/json", 403},
		{"bad content", `{}`, s.Origin, "text/plain", 415},
		{"short password", `{"email":"a@example.test","password":"short"}`, s.Origin, "application/json", 400},
		{"unknown field", `{"admin":true}`, s.Origin, "application/json", 400},
		{"trailing json", `{} {}`, s.Origin, "application/json", 400},
		{"oversized", strings.Repeat("x", 5000), s.Origin, "application/json", 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("POST", "/api/v1/auth/register", strings.NewReader(tc.body))
			r.Header.Set("Origin", tc.origin)
			r.Header.Set("Content-Type", tc.content)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.status {
				t.Fatalf("got %d", w.Code)
			}
		})
	}
}
