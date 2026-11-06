package catalog

import (
	"atlas.local/backend/internal/identity"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestCatalogIntegration(t *testing.T) {
	dsn := os.Getenv("ATLAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, migrate := range []func(context.Context, *sql.DB) error{identity.Migrate, Migrate, Migrate} {
		if err = migrate(context.Background(), db); err != nil {
			t.Fatal(err)
		}
	}
	auth := identity.New(db, "https://atlas.test", true, false)
	s := &Server{DB: db, Auth: auth}
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	owners := []string{id(), id()}
	tokens := []string{id(), id()}
	for i, owner := range owners {
		if _, err = db.Exec("INSERT INTO users(id,email,password_hash) VALUES($1,$2,'synthetic-unusable-hash')", owner, owner+"@example.test"); err != nil {
			t.Fatal(err)
		}
		hash := sha256.Sum256([]byte(tokens[i]))
		if _, err = db.Exec("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", hex.EncodeToString(hash[:]), owner); err != nil {
			t.Fatal(err)
		}
	}
	request := func(method, path string, body any, who int, origin string) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		if who >= 0 {
			r.AddCookie(&http.Cookie{Name: "__Host-atlas_session", Value: tokens[who]})
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("got %d want %d: %s", w.Code, status, w.Body.String())
		}
		if w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal("private response cacheable")
		}
	}
	origin := "https://atlas.test"
	for _, path := range []string{"/api/v1/portfolios", "/api/v1/assets", "/api/v1/export"} {
		check(request("GET", path, nil, -1, ""), 401)
	}
	check(request("POST", "/api/v1/portfolios", map[string]string{"name": "Denied"}, 0, "https://foreign.test"), 403)
	check(request("POST", "/api/v1/portfolios", map[string]string{"name": "Owned", "user_id": owners[1]}, 0, origin), 400)
	check(request("POST", "/api/v1/portfolios", map[string]string{"name": "\n"}, 0, origin), 400)
	var p, foreign Portfolio
	for i, target := range []*Portfolio{&p, &foreign} {
		w := request("POST", "/api/v1/portfolios", map[string]string{"name": "Synthetic portfolio"}, i, origin)
		check(w, 201)
		if err = json.Unmarshal(w.Body.Bytes(), target); err != nil {
			t.Fatal(err)
		}
	}
	path := "/api/v1/portfolios/" + p.ID
	check(request("PATCH", path, map[string]string{"name": "Stolen"}, 1, origin), 404)
	check(request("GET", path+"/accounts", nil, 1, ""), 404)
	account := map[string]string{"name": "Synthetic account", "kind": "brokerage", "currency": "EUR"}
	check(request("POST", path+"/accounts", account, 1, origin), 404)
	w := request("POST", path+"/accounts", account, 0, origin)
	check(w, 201)
	var a Account
	json.Unmarshal(w.Body.Bytes(), &a)
	check(request("PATCH", path+"/accounts/"+a.ID, map[string]bool{"archived": true}, 1, origin), 404)
	check(request("PATCH", "/api/v1/portfolios/"+foreign.ID+"/accounts/"+a.ID, map[string]bool{"archived": true}, 0, origin), 404)
	check(request("PATCH", path+"/accounts/"+a.ID, map[string]string{"currency": "USD"}, 0, origin), 400)
	check(request("POST", path+"/accounts", map[string]string{"name": "Livret", "kind": "savings", "currency": "USD", "savings_product": "livret_a"}, 0, origin), 400)
	check(request("PATCH", path, map[string]bool{"archived": true}, 0, origin), 200)
	check(request("POST", path+"/accounts", account, 0, origin), 409)
	check(request("PATCH", path, map[string]any{"name": "Renamed", "archived": false}, 0, origin), 200)
	check(request("PATCH", path+"/accounts/"+a.ID, map[string]bool{"archived": true}, 0, origin), 200)
	check(request("PATCH", path+"/accounts/"+a.ID, map[string]bool{"archived": false}, 0, origin), 200)
	asset := map[string]string{"name": "Synthetic security", "kind": "stock", "symbol": "TEST", "namespace": "XPAR", "reference": "FR0000120271", "currency": "EUR"}
	w = request("POST", "/api/v1/assets", asset, 0, origin)
	check(w, 201)
	var security Asset
	json.Unmarshal(w.Body.Bytes(), &security)
	check(request("POST", "/api/v1/assets", asset, 0, origin), 409)
	check(request("POST", "/api/v1/assets", asset, 1, origin), 201)
	check(request("PATCH", "/api/v1/assets/"+security.ID, map[string]string{"name": "Stolen"}, 1, origin), 404)
	asset["reference"] = "FR0000120270"
	check(request("POST", "/api/v1/assets", asset, 0, origin), 400)
	check(request("POST", "/api/v1/portfolios", map[string]string{"name": "Second"}, 0, origin), 201)
	w = request("GET", "/api/v1/portfolios?limit=1", nil, 0, "")
	check(w, 200)
	var page struct {
		Items []Portfolio `json:"items"`
		Next  string      `json:"next_cursor"`
	}
	json.Unmarshal(w.Body.Bytes(), &page)
	if len(page.Items) != 1 || page.Next == "" {
		t.Fatal("pagination missing")
	}
	first := page.Items[0].ID
	w = request("GET", "/api/v1/portfolios?limit=1&cursor="+page.Next, nil, 0, "")
	check(w, 200)
	json.Unmarshal(w.Body.Bytes(), &page)
	if len(page.Items) != 1 || page.Items[0].ID == first || page.Next != "" {
		t.Fatal("pagination overlap")
	}
	check(request("GET", "/api/v1/portfolios?limit=101", nil, 0, ""), 400)
	w = request("GET", "/api/v1/export", nil, 0, "")
	check(w, 200)
	var exported struct {
		Portfolios []Portfolio `json:"portfolios"`
		Accounts   []Account   `json:"accounts"`
		Assets     []Asset     `json:"assets"`
	}
	json.Unmarshal(w.Body.Bytes(), &exported)
	if len(exported.Portfolios) != 2 || len(exported.Accounts) != 1 || len(exported.Assets) != 1 || strings.Contains(w.Body.String(), foreign.ID) || strings.Contains(w.Body.String(), "password_hash") || strings.Contains(w.Body.String(), "token_hash") {
		t.Fatal("export content or ownership failure")
	}
	if _, err = db.Exec("INSERT INTO accounts(id,user_id,portfolio_id,name,kind,currency) VALUES($1,$2,$3,'Forbidden','brokerage','EUR')", id(), owners[1], p.ID); err == nil {
		t.Fatal("database permits cross-owner link")
	}
}

func TestISIN(t *testing.T) {
	for _, tc := range []struct {
		s     string
		valid bool
	}{{"FR0000120271", true}, {"US0378331005", true}, {"FR0000120270", false}, {"AAPL", false}, {"US037833100<", false}} {
		if validISIN(tc.s) != tc.valid {
			t.Errorf("ISIN %q", tc.s)
		}
	}
}
