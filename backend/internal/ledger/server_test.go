package ledger

import (
	"atlas.local/backend/internal/catalog"
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
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestJournalIntegration(t *testing.T) {
	dsn := os.Getenv("ATLAS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("dedicated PostgreSQL required")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, m := range []func(context.Context, *sql.DB) error{identity.Migrate, catalog.Migrate, Migrate, Migrate} {
		if err = m(context.Background(), db); err != nil {
			t.Fatal(err)
		}
	}
	owners := []string{token(), token()}
	tokens := []string{token(), token()}
	accountIDs := []string{token(), token()}
	assetIDs := []string{token(), token()}
	for i, owner := range owners {
		queries := []struct {
			sql  string
			args []any
		}{
			{"INSERT INTO users(id,email,password_hash) VALUES($1,$2,'synthetic-unusable')", []any{owner, owner + "@example.test"}},
			{"INSERT INTO portfolios(id,user_id,name) VALUES($1,$2,'Synthetic')", []any{accountIDs[i], owner}},
			{"INSERT INTO accounts(id,user_id,portfolio_id,name,kind,currency) VALUES($1,$2,$1,'Synthetic','brokerage','EUR')", []any{accountIDs[i], owner}},
			{"INSERT INTO assets(id,user_id,name,kind,symbol,namespace,reference,currency) VALUES($1,$2,'Synthetic','stock','TEST','XPAR','FR0000120271','EUR')", []any{assetIDs[i], owner}},
		}
		for _, q := range queries {
			if _, err = db.Exec(q.sql, q.args...); err != nil {
				t.Fatal(err)
			}
		}
		h := sha256.Sum256([]byte(tokens[i]))
		if _, err = db.Exec("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", hex.EncodeToString(h[:]), owner); err != nil {
			t.Fatal(err)
		}
	}
	s := &Server{DB: db, Auth: identity.New(db, "https://atlas.test", true, false)}
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)
	(&catalog.Server{DB: db, Auth: s.Auth}).RegisterRoutes(mux)
	req := func(method, path string, body any, who int, key string) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, strings.NewReader(string(raw)))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", "https://atlas.test")
		r.Header.Set("Idempotency-Key", key)
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
			t.Fatal("cacheable private data")
		}
	}
	event := func(kind, quantity, price, amount string) Event {
		e := fixture(kind, accountIDs[0], quantity, price, amount)
		if e.AssetID != "" {
			e.AssetID = assetIDs[0]
		}
		return e
	}
	for _, path := range []string{"operations", "summary", "prices", "financial-export"} {
		check(req("GET", "/api/v1/"+path, nil, -1, ""), 401)
	}
	deposit := event("deposit", "", "", "2000")
	key := token()
	check(req("POST", "/api/v1/operations", deposit, 0, ""), 400)
	check(req("POST", "/api/v1/operations", deposit, 0, key), 201)
	check(req("POST", "/api/v1/operations", deposit, 0, key), 200)
	deposit.Amount = "3000"
	check(req("POST", "/api/v1/operations", deposit, 0, key), 409)
	first := event("buy", "5", "100", "")
	w := req("POST", "/api/v1/operations", first, 0, token())
	check(w, 201)
	var buy Operation
	json.Unmarshal(w.Body.Bytes(), &buy)
	check(req("POST", "/api/v1/operations", event("buy", "5", "120", ""), 0, token()), 201)
	check(req("POST", "/api/v1/operations", event("buy", "100", "100", ""), 0, token()), 422)
	check(req("POST", "/api/v1/operations", event("sell", "11", "100", ""), 0, token()), 422)
	check(req("POST", "/api/v1/operations", first, 1, token()), 404)
	observation := map[string]string{"asset_id": assetIDs[0], "currency": "EUR", "value": "125", "observed_at": "2020-01-02T12:00:00Z", "source": "synthetic fixture"}
	check(req("POST", "/api/v1/prices", observation, 1, ""), 404)
	check(req("POST", "/api/v1/prices", observation, 0, ""), 201)
	summary := func() Summary {
		t.Helper()
		w := req("GET", "/api/v1/summary", nil, 0, "")
		check(w, 200)
		var out Summary
		if err = json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	if got := summary(); got.Total.Exact != "2150" || got.Result.Exact != "150" || got.Positions[0].AverageCost.Exact != "110" {
		t.Fatal("T01/T02 incorrect")
	}
	replacement := event("buy", "5", "90", "")
	correct := map[string]any{"replacement": replacement, "reason": "Synthetic correction T07"}
	check(req("POST", "/api/v1/operations/"+buy.ID+"/corrections", correct, 1, token()), 404)
	check(req("POST", "/api/v1/operations/"+buy.ID+"/corrections", correct, 0, token()), 201)
	if got := summary(); got.Total.Exact != "2200" || got.Positions[0].AverageCost.Exact != "105" {
		t.Fatal("T07 backdated correction not replayed")
	}
	w = req("GET", "/api/v1/operations", nil, 0, "")
	check(w, 200)
	var history struct {
		Items []Operation `json:"items"`
	}
	json.Unmarshal(w.Body.Bytes(), &history)
	if len(history.Items) != 4 || history.Items[1].Active {
		t.Fatal("audit original lost")
	}
	depID := history.Items[0].ID
	check(req("POST", "/api/v1/operations/"+depID+"/corrections", map[string]any{"void": true, "reason": "Would invalidate funding"}, 0, token()), 422)
	if summary().Total.Exact != "2200" {
		t.Fatal("failed correction changed data")
	}
	w = req("GET", "/api/v1/history?from=2020-01-01T12:00:00Z&to=2020-01-02T12:00:00Z", nil, 0, "")
	check(w, 200)
	if !strings.Contains(w.Body.String(), `"missing":true`) {
		t.Fatal("T08 missing historical price concealed")
	}
	// Concurrent retries must produce one deposit and one idempotency result.
	sameKey := token()
	sameDeposit := event("deposit", "", "", "10")
	var wg sync.WaitGroup
	codes := make(chan int, 4)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); codes <- req("POST", "/api/v1/operations", sameDeposit, 0, sameKey).Code }()
	}
	wg.Wait()
	close(codes)
	created := 0
	for code := range codes {
		if code == 201 {
			created++
		} else if code != 200 {
			t.Fatalf("retry status %d", code)
		}
	}
	if created != 1 || summary().Total.Exact != "2210" {
		t.Fatal("concurrent duplicate financial write")
	}
	csv := "external_id,kind,account_id,occurred_at,amount\nsynthetic-import,deposit," + accountIDs[0] + ",2020-01-03T12:00:00Z,20\n"
	preview := func(text string) string {
		t.Helper()
		w := req("POST", "/api/v1/imports/preview", map[string]string{"format": "atlas-csv-v1", "csv": text}, 0, "")
		check(w, 200)
		var p struct {
			ID string `json:"id"`
		}
		json.Unmarshal(w.Body.Bytes(), &p)
		return p.ID
	}
	before := summary().Total.Exact
	batch := preview(csv)
	if summary().Total.Exact != before {
		t.Fatal("preview wrote financial data")
	}
	check(req("POST", "/api/v1/imports/"+batch+"/confirm", map[string]string{}, 1, ""), 404)
	check(req("POST", "/api/v1/imports/"+batch+"/confirm", map[string]string{}, 0, ""), 200)
	check(req("POST", "/api/v1/imports/"+batch+"/confirm", map[string]string{}, 0, ""), 200)
	if summary().Total.Exact != "2230" {
		t.Fatal("T06 duplicate import")
	}
	again := preview(strings.ReplaceAll(csv, "\n", "\r\n"))
	check(req("POST", "/api/v1/imports/"+again+"/confirm", map[string]string{}, 0, ""), 200)
	if summary().Total.Exact != "2230" {
		t.Fatal("external ID duplicate across files")
	}
	badCSV := "external_id,kind,account_id,occurred_at,amount\nbad-first,deposit," + accountIDs[0] + ",2020-01-04T12:00:00Z,10\nbad-second,withdrawal," + accountIDs[0] + ",2020-01-04T12:00:00Z,999999\n"
	bad := preview(badCSV)
	check(req("POST", "/api/v1/imports/"+bad+"/confirm", map[string]string{}, 0, ""), 422)
	if summary().Total.Exact != "2230" {
		t.Fatal("partial import committed")
	}
	w = req("GET", "/api/v1/financial-export", nil, 0, "")
	check(w, 200)
	if !strings.Contains(w.Body.String(), "atlas-portfolio") || strings.Contains(w.Body.String(), owners[1]) || strings.Contains(w.Body.String(), "password_hash") || strings.Contains(w.Body.String(), "token_hash") {
		t.Fatal("financial export scope failure")
	}
	// Metadata creation and financial writes share a stable lock order.
	concurrent := make(chan int, 20)
	var concurrentWait sync.WaitGroup
	for i := 0; i < 10; i++ {
		concurrentWait.Add(2)
		go func() {
			defer concurrentWait.Done()
			concurrent <- req("POST", "/api/v1/portfolios/"+accountIDs[0]+"/accounts", map[string]string{"name": "Concurrent synthetic", "kind": "brokerage", "currency": "EUR"}, 0, token()).Code
		}()
		go func() {
			defer concurrentWait.Done()
			concurrent <- req("POST", "/api/v1/operations", event("deposit", "", "", "1"), 0, token()).Code
		}()
	}
	concurrentWait.Wait()
	close(concurrent)
	for status := range concurrent {
		if status != 201 {
			t.Fatalf("concurrent metadata/journal write failed: %d", status)
		}
	}
	w = req("GET", "/api/v1/summary", nil, 1, "")
	check(w, 200)
	var other Summary
	json.Unmarshal(w.Body.Bytes(), &other)
	if len(other.Positions) != 0 || other.Total.Exact != "0" {
		t.Fatal("T09 cross-user financial leak")
	}
	// Broker imports use the same transactional journal and private ownership checks.
	brokerFields := map[string]string{"datetime": "2026-01-01T12:00:00Z", "account_type": "DEFAULT", "category": "TRADING", "type": "BUY", "symbol": "FR0000120271", "shares": "1", "price": "100", "amount": "-101", "fee": "1", "currency": "EUR", "transaction_id": "synthetic-trade"}
	brokerIn := importRequest{Format: "trade-republic-transactions-v1", CSV: brokerCSV(trHeader, brokerFields), AccountID: accountIDs[0], Assets: map[string]string{"FR0000120271": assetIDs[0]}}
	brokerPreview := req("POST", "/api/v1/imports/preview", brokerIn, 0, "")
	check(brokerPreview, 200)
	var report struct {
		ID    string      `json:"id"`
		Valid bool        `json:"can_confirm"`
		Rows  []ImportRow `json:"rows"`
	}
	if err = json.Unmarshal(brokerPreview.Body.Bytes(), &report); err != nil || !report.Valid {
		t.Fatalf("broker preview: %s", brokerPreview.Body.String())
	}
	check(req("POST", "/api/v1/imports/"+report.ID+"/confirm", map[string]string{}, 0, ""), 200)
	afterBroker := summary().Total.Exact
	check(req("POST", "/api/v1/imports/"+report.ID+"/confirm", map[string]string{}, 0, ""), 200)
	if summary().Total.Exact != afterBroker {
		t.Fatal("broker retry duplicate")
	}
	brokerIn.CSV = strings.ReplaceAll(brokerIn.CSV, "\n", "\r\n")
	w = req("POST", "/api/v1/imports/preview", brokerIn, 0, "")
	check(w, 200)
	if err = json.Unmarshal(w.Body.Bytes(), &report); err != nil || !report.Rows[0].Duplicate {
		t.Fatalf("broker dedupe: %s", w.Body.String())
	}
	brokerIn.Assets["FR0000120271"] = assetIDs[1]
	w = req("POST", "/api/v1/imports/preview", brokerIn, 0, "")
	check(w, 200)
	if err = json.Unmarshal(w.Body.Bytes(), &report); err != nil || report.Valid || report.Rows[0].Error != "resource_not_available" {
		t.Fatal("broker foreign mapping accepted")
	}

	// P4.5 is a read-only comparison, including archived references and historical dates.
	live := summary()
	var cashRef, quantityRef string
	for _, cash := range live.Cash {
		if cash.AccountID == accountIDs[0] {
			cashRef = cash.Amount.Display
		}
	}
	for _, position := range live.Positions {
		if position.AccountID == accountIDs[0] && position.AssetID == assetIDs[0] {
			quantityRef = position.Quantity.Exact
		}
	}
	reconcileIn := reconciliationRequest{Format: "atlas-balances-v1", AccountID: accountIDs[0], Currency: "EUR", AsOf: "2026-01-02T12:00:00Z", CSV: "kind,asset_id,value\ncash,," + cashRef + "\nposition," + assetIDs[0] + "," + quantityRef + "\n"}
	var beforeOperations, beforeBatches int
	if err = db.QueryRow("SELECT (SELECT count(*) FROM operations WHERE user_id=$1),(SELECT count(*) FROM import_batches WHERE user_id=$1)", owners[0]).Scan(&beforeOperations, &beforeBatches); err != nil {
		t.Fatal(err)
	}
	w = req("POST", "/api/v1/reconciliations/preview", reconcileIn, 0, "")
	check(w, 200)
	var reconciled reconciliationReport
	if err = json.Unmarshal(w.Body.Bytes(), &reconciled); err != nil || reconciled.Differences != 0 || len(reconciled.Rows) != 2 || !reconciled.CashChecked {
		t.Fatalf("reconciliation: %s", w.Body.String())
	}
	reconcileIn.AsOf = "2019-01-01T00:00:00Z"
	reconcileIn.CSV = "kind,asset_id,value\ncash,,0\nposition," + assetIDs[0] + ",0\n"
	w = req("POST", "/api/v1/reconciliations/preview", reconcileIn, 0, "")
	check(w, 200)
	if err = json.Unmarshal(w.Body.Bytes(), &reconciled); err != nil || reconciled.Differences != 0 {
		t.Fatalf("historical reconciliation: %s", w.Body.String())
	}
	check(req("PATCH", "/api/v1/portfolios/"+accountIDs[0]+"/accounts/"+accountIDs[0], map[string]bool{"archived": true}, 0, ""), 200)
	w = req("POST", "/api/v1/reconciliations/preview", reconcileIn, 0, "")
	check(w, 200)
	check(req("PATCH", "/api/v1/portfolios/"+accountIDs[0]+"/accounts/"+accountIDs[0], map[string]bool{"archived": false}, 0, ""), 200)
	reconcileIn.AccountID = accountIDs[1]
	check(req("POST", "/api/v1/reconciliations/preview", reconcileIn, 0, ""), 404)
	reconcileIn.AccountID = accountIDs[0]
	reconcileIn.CSV = "kind,asset_id,value\nposition," + assetIDs[1] + ",0\n"
	check(req("POST", "/api/v1/reconciliations/preview", reconcileIn, 0, ""), 404)
	reconcileIn.CSV = "kind,asset_id,value\ncash,,0\n"
	reconcileIn.Currency = "USD"
	check(req("POST", "/api/v1/reconciliations/preview", reconcileIn, 0, ""), 422)
	reconcileIn.Currency = "EUR"
	reconcileIn.AsOf = "2999-01-01T00:00:00Z"
	check(req("POST", "/api/v1/reconciliations/preview", reconcileIn, 0, ""), 422)
	reconcileIn.AsOf = "2019-01-01T00:00:00Z"
	check(req("POST", "/api/v1/reconciliations/preview", reconcileIn, -1, ""), 401)
	check(req("POST", "/api/v1/reconciliations/preview", map[string]string{"format": "atlas-balances-v1", "unexpected": "field"}, 0, ""), 400)
	var afterOperations, afterBatches int
	if err = db.QueryRow("SELECT (SELECT count(*) FROM operations WHERE user_id=$1),(SELECT count(*) FROM import_batches WHERE user_id=$1)", owners[0]).Scan(&afterOperations, &afterBatches); err != nil {
		t.Fatal(err)
	}
	if beforeOperations != afterOperations || beforeBatches != afterBatches {
		t.Fatal("reconciliation wrote operations/import batches")
	}

	// Operational status never fetches market data and exposes only this owner's persistence.
	var providerCalls atomic.Int32
	var providerHTTP atomic.Int32
	providerHTTP.Store(429)
	providerServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		providerCalls.Add(1)
		if providerHTTP.Load() != 200 {
			w.Header().Set("Retry-After", "120")
			w.WriteHeader(int(providerHTTP.Load()))
			w.Write([]byte("private upstream body"))
			return
		}
		w.Write([]byte(ecbFixture))
	}))
	defer providerServer.Close()
	s.ECB = &ECBProvider{URL: providerServer.URL, Client: providerServer.Client()}
	check(req("GET", "/api/v1/market/status", nil, -1, ""), 401)
	w = req("GET", "/api/v1/market/status", nil, 0, "")
	check(w, 200)
	if providerCalls.Load() != 0 || !strings.Contains(w.Body.String(), "never_fetched") {
		t.Fatal("status contacted provider")
	}
	beforePrices := 0
	if err = db.QueryRow("SELECT count(*) FROM price_observations WHERE user_id=$1", owners[0]).Scan(&beforePrices); err != nil {
		t.Fatal(err)
	}
	w = req("POST", "/api/v1/market/fx/refresh", map[string]string{}, 0, "")
	check(w, 503)
	if w.Header().Get("Retry-After") == "" || strings.Contains(w.Body.String(), "private upstream") {
		t.Fatal("missing retry hint or leaked provider error")
	}
	afterPrices := 0
	if err = db.QueryRow("SELECT count(*) FROM price_observations WHERE user_id=$1", owners[0]).Scan(&afterPrices); err != nil {
		t.Fatal(err)
	}
	if beforePrices != afterPrices {
		t.Fatal("provider failure changed stored observations")
	}
	w = req("POST", "/api/v1/market/fx/refresh", map[string]string{}, 0, "")
	check(w, 503)
	if providerCalls.Load() != 1 {
		t.Fatal("failure backoff did not protect provider quota")
	}
	s.ECB.mu.Lock()
	s.ECB.nextAllowed = time.Time{}
	s.ECB.mu.Unlock()
	providerHTTP.Store(200)
	check(req("POST", "/api/v1/market/fx/refresh", map[string]string{}, 0, ""), 200)
	var operational struct {
		Provider        providerSnapshot `json:"provider"`
		Synchronization struct {
			Last      *time.Time `json:"last_persisted_at"`
			Reference string     `json:"reference_date"`
		} `json:"synchronization"`
	}
	w = req("GET", "/api/v1/market/status", nil, 0, "")
	check(w, 200)
	if err = json.Unmarshal(w.Body.Bytes(), &operational); err != nil || operational.Provider.State != "cached" || operational.Synchronization.Last == nil || operational.Synchronization.Reference != "2020-01-02" {
		t.Fatalf("own sync missing: %s", w.Body.String())
	}
	w = req("GET", "/api/v1/market/status", nil, 1, "")
	check(w, 200)
	if err = json.Unmarshal(w.Body.Bytes(), &operational); err != nil || operational.Synchronization.Last != nil || operational.Synchronization.Reference != "" || strings.Contains(w.Body.String(), owners[0]) {
		t.Fatalf("foreign sync leaked: %s", w.Body.String())
	}
	if providerCalls.Load() != 2 {
		t.Fatal("status bypassed provider cache")
	}

	t.Run("canonical quantity returned by API can be fully sold", func(t *testing.T) {
		check := func(response *httptest.ResponseRecorder, status int) {
			t.Helper()
			if response.Code != status {
				t.Fatalf("API status %d, expected %d: %s", response.Code, status, response.Body.String())
			}
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("cacheable private data")
			}
		}
		accountID := token()
		if _, err := db.Exec("INSERT INTO accounts(id,user_id,portfolio_id,name,kind,currency) VALUES($1,$2,$3,'Synthetic canonical quantity','brokerage','EUR')", accountID, owners[0], accountIDs[0]); err != nil {
			t.Fatal(err)
		}
		const capital = "1000000000000000000"
		const price = "0.000000000000000001"
		check(req("POST", "/api/v1/operations", Event{Kind: "deposit", AccountID: accountID, Amount: capital, At: "2020-01-01T00:00:00Z"}, 0, token()), 201)
		check(req("POST", "/api/v1/operations", Event{Kind: "buy", AccountID: accountID, AssetID: assetIDs[0], Amount: capital, Price: price, At: "2020-01-02T00:00:00Z"}, 0, token()), 201)
		response := req("GET", "/api/v1/summary", nil, 0, "")
		check(response, 200)
		var result Summary
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		quantity := ""
		for _, position := range result.Positions {
			if position.AccountID == accountID && position.AssetID == assetIDs[0] {
				quantity = position.Quantity.Exact
			}
		}
		if quantity != "1"+strings.Repeat("0", 36) {
			t.Fatal("API did not return the expected canonical quantity")
		}
		sell := Event{Kind: "sell", AccountID: accountID, AssetID: assetIDs[0], Quantity: quantity, Price: price, At: "2020-01-03T00:00:00Z"}
		check(req("POST", "/api/v1/operations", sell, 1, token()), 404)
		sellKey := token()
		check(req("POST", "/api/v1/operations", sell, 0, sellKey), 201)
		check(req("POST", "/api/v1/operations", sell, 0, sellKey), 200)
		response = req("GET", "/api/v1/summary", nil, 0, "")
		check(response, 200)
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		cashFound := false
		for _, cash := range result.Cash {
			if cash.AccountID == accountID {
				cashFound = true
				if cash.Amount.Exact != capital {
					t.Fatal("exact capital not restored")
				}
			}
		}
		if !cashFound {
			t.Fatal("cash account missing")
		}
		response = req("GET", "/api/v1/financial-export", nil, 0, "")
		check(response, 200)
		var exported struct {
			Operations []Operation `json:"operations"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &exported); err != nil {
			t.Fatal(err)
		}
		count := 0
		for _, operation := range exported.Operations {
			if operation.AccountID == accountID {
				count++
				if operation.Kind == "sell" && operation.Quantity != quantity {
					t.Fatal("stored quantity changed")
				}
			}
		}
		if count != 3 {
			t.Fatal("sale retry duplicated an operation")
		}
	})

	t.Run("portfolio history checks owner including empty archived portfolios", func(t *testing.T) {
		portfolio := token()
		if _, err := db.Exec("INSERT INTO portfolios(id,user_id,name,archived) VALUES($1,$2,'Synthetic empty historical portfolio',true)", portfolio, owners[0]); err != nil {
			t.Fatal(err)
		}
		offset := req("GET", "/api/v1/history?from=2020-01-01T14:00:00.123456789%2B02:00&to=2020-01-02T14:00:00.123456789%2B02:00&portfolio_id="+portfolio, nil, 0, "")
		if offset.Code != 200 {
			t.Fatalf("offset history: %d", offset.Code)
		}
		var offsetBody struct {
			Items    []TimelinePoint `json:"items"`
			Timezone string          `json:"timezone"`
		}
		if err := json.Unmarshal(offset.Body.Bytes(), &offsetBody); err != nil {
			t.Fatal(err)
		}
		if offsetBody.Timezone != "UTC" || len(offsetBody.Items) != 2 || offsetBody.Items[0].At.Format(time.RFC3339Nano) != "2020-01-01T12:00:00.123456789Z" {
			t.Fatal("history failed UTC/nanosecond contract")
		}
		path := "/api/v1/history?from=2020-01-01T12:00:00Z&to=2020-01-02T12:00:00Z&portfolio_id="
		for _, tc := range []struct {
			id          string
			who, status int
		}{{portfolio, 0, 200}, {portfolio, 1, 404}, {portfolio, -1, 401}, {token(), 0, 404}} {
			response := req("GET", path+tc.id, nil, tc.who, "")
			if response.Code != tc.status || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("private scoped history: %d", response.Code)
			}
			if tc.status == 200 {
				var body struct {
					Items     []TimelinePoint `json:"items"`
					Portfolio string          `json:"portfolio_id"`
					Metric    string          `json:"metric"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if body.Portfolio != portfolio || body.Metric != "valuation" || len(body.Items) != 2 {
					t.Fatal("incorrect scoped history metadata")
				}
				for _, p := range body.Items {
					if p.Value == nil || p.Value.Exact != "0" || p.Missing || p.OldObservations {
						t.Fatal("empty owned portfolio was contaminated by other accounts")
					}
				}
			}
		}
	})

	t.Run("portfolio allocation is private and agrees with scoped totals", func(t *testing.T) {
		for owner := 0; owner < 2; owner++ {
			response := req("GET", "/api/v1/summary", nil, owner, "")
			if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("private allocation status %d", response.Code)
			}
			var body Summary
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if _, exists := body.PortfolioAllocations[accountIDs[owner]]; !exists {
				t.Fatal("owned allocation missing")
			}
			if _, exists := body.PortfolioAllocations[accountIDs[1-owner]]; exists {
				t.Fatal("foreign portfolio allocation exposed")
			}
			for id, allocation := range body.PortfolioAllocations {
				total := body.PortfolioValues[id]
				if (total == nil) != allocation.Missing || (allocation.Total == nil) != allocation.Missing {
					t.Fatal("missing value concealed")
				}
				if total != nil && (allocation.Total.Exact != total.Exact || allocation.Known.Exact != total.Exact) {
					t.Fatal("complete allocation disagrees with portfolio value")
				}
			}
		}
	})

}
