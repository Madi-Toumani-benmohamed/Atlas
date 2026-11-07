package httpserver

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestReadinessIsGenericCachedAndRecovers(t *testing.T) {
	now := time.Now()
	var calls int
	failing := false
	probe := newReadiness(func(context.Context) error {
		calls++
		if failing {
			return errors.New("postgres://private-user:secret@private-host/private-db")
		}
		return nil
	})
	probe.now = func() time.Time { return now }
	check := func(status int) {
		t.Helper()
		w := httptest.NewRecorder()
		probe.ServeHTTP(w, httptest.NewRequest("GET", "/readyz", nil))
		if w.Code != status || w.Header().Get("Cache-Control") != "no-store" || !strings.Contains(w.Header().Get("Content-Type"), "application/json") {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
		if strings.Contains(w.Body.String(), "private") || strings.Contains(w.Body.String(), "secret") {
			t.Fatal("readiness leaked driver error")
		}
	}
	check(200)
	failing = true
	check(200)
	if calls != 1 {
		t.Fatal("uncached probe")
	}
	now = now.Add(6 * time.Second)
	check(503)
	check(503)
	if calls != 2 {
		t.Fatal("failed probe not cached")
	}
	failing = false
	now = now.Add(6 * time.Second)
	check(200)
	if calls != 3 {
		t.Fatal("readiness did not recover")
	}
}
func TestReadinessTimeoutAndConcurrentProbe(t *testing.T) {
	p := newReadiness(func(ctx context.Context) error { <-ctx.Done(); return ctx.Err() })
	p.timeout = 10 * time.Millisecond
	w := httptest.NewRecorder()
	p.ServeHTTP(w, httptest.NewRequest("GET", "/readyz", nil))
	if w.Code != 503 {
		t.Fatal("timed out probe reported ready")
	}
	var calls atomic.Int32
	p = newReadiness(func(context.Context) error { calls.Add(1); return nil })
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/readyz", nil))
		}()
	}
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatal("probe burst reached database repeatedly")
	}
}
func TestUnconfiguredAppIsAliveButNotReady(t *testing.T) {
	for _, handler := range []http.Handler{Handler(), Handler(nil)} {
		for _, tc := range []struct {
			path   string
			status int
		}{{"/healthz", 200}, {"/readyz", 503}} {
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, httptest.NewRequest("GET", tc.path, nil))
			if w.Code != tc.status {
				t.Fatalf("%s %d", tc.path, w.Code)
			}
		}
	}
}
