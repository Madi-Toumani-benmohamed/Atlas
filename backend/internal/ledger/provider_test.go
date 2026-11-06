package ledger

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestProviderRetryDelayBoundaries(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		failures int
		hint     string
		want     time.Duration
	}{{1, "", 30 * time.Second}, {2, "", time.Minute}, {7, "", 30 * time.Minute}, {100, "", 30 * time.Minute}, {1, "120", 2 * time.Minute}, {1, "9999999999999", time.Hour}, {1, "-1", 30 * time.Second}, {1, "invalid", 30 * time.Second}, {1, now.Add(3 * time.Minute).Format(http.TimeFormat), 3 * time.Minute}, {1, now.Add(2 * time.Hour).Format(http.TimeFormat), time.Hour}, {1, now.Add(-time.Hour).Format(http.TimeFormat), 30 * time.Second}} {
		if got := providerRetryDelay(tc.failures, tc.hint, now); got != tc.want {
			t.Fatalf("%+v got=%s", tc, got)
		}
	}
}
func TestProviderBackoffPreservesCacheAndRecovers(t *testing.T) {
	var calls atomic.Int32
	var code atomic.Int32
	code.Store(429)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if code.Load() != 200 {
			w.Header().Set("Retry-After", "120")
			w.WriteHeader(int(code.Load()))
			w.Write([]byte("private upstream error body"))
			return
		}
		w.Write([]byte(ecbFixture))
	}))
	defer server.Close()
	old := time.Now().Add(-8 * time.Hour)
	var logs bytes.Buffer
	p := &ECBProvider{URL: server.URL, Client: server.Client(), cached: []FXRate{{"USD", "2020-01-01", "1"}}, fetched: old, logger: slog.New(slog.NewJSONHandler(&logs, nil))}
	for i := 0; i < 3; i++ {
		if _, err := p.rates(context.Background()); err == nil {
			t.Fatal("failed provider reported success")
		}
	}
	s := p.snapshot(time.Now())
	if calls.Load() != 1 || s.State != "backoff" || s.RetryAfterSeconds < 1 || s.RetryAfterSeconds > 120 || s.LastErrorCode != "ecb_rate_limited" || s.ReferenceDate != "2020-01-01" || !p.fetched.Equal(old) {
		t.Fatalf("%+v calls=%d", s, calls.Load())
	}
	if strings.Contains(logs.String(), "private") || strings.Contains(logs.String(), server.URL) {
		t.Fatal("provider logs leaked error/endpoint")
	}
	p.mu.Lock()
	p.nextAllowed = time.Time{}
	p.mu.Unlock()
	code.Store(200)
	rates, err := p.rates(context.Background())
	if err != nil || rates[0].Value != "10/11" {
		t.Fatalf("%v %+v", err, rates)
	}
	s = p.snapshot(time.Now())
	if s.State != "cached" || s.LastErrorCode != "" || s.RetryAfterSeconds != 0 || calls.Load() != 2 {
		t.Fatalf("%+v", s)
	}
}
func TestProviderSingleFetchAndNonblockingStatus(t *testing.T) {
	entered, release := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			close(entered)
		}
		<-release
		w.Write([]byte(ecbFixture))
	}))
	defer server.Close()
	p := &ECBProvider{URL: server.URL, Client: server.Client()}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := p.rates(context.Background()); err != nil {
				t.Error(err)
			}
		}()
	}
	<-entered
	done := make(chan providerSnapshot, 1)
	go func() { done <- p.snapshot(time.Now()) }()
	select {
	case status := <-done:
		if status.State != "refreshing" {
			t.Error(status.State)
		}
	case <-time.After(time.Second):
		t.Error("status blocked on network fetch")
	}
	close(release)
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatal("concurrent provider quota bypass")
	}
}

type providerRoundTripper func(*http.Request) (*http.Response, error)

func (f providerRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestProviderSanitizesClientErrorsAndCancellation(t *testing.T) {
	var logs bytes.Buffer
	p := &ECBProvider{logger: slog.New(slog.NewJSONHandler(&logs, nil)), Client: &http.Client{Transport: providerRoundTripper(func(*http.Request) (*http.Response, error) { return nil, errors.New("private-secret@internal-host") })}}
	if _, err := p.rates(context.Background()); err == nil {
		t.Fatal("expected failure")
	}
	if strings.Contains(logs.String(), "private-secret") || strings.Contains(logs.String(), "internal-host") || p.snapshot(time.Now()).LastErrorCode != "ecb_unavailable" {
		t.Fatal("raw client error leaked")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	p = &ECBProvider{logger: slog.New(slog.NewJSONHandler(&logs, nil)), Client: &http.Client{Transport: providerRoundTripper(func(*http.Request) (*http.Response, error) { cancel(); return nil, context.Canceled })}}
	if _, err := p.rates(ctx); err == nil {
		t.Fatal("cancelled request succeeded")
	}
	if s := p.snapshot(time.Now()); s.State != "never_fetched" || s.RetryAfterSeconds != 0 || s.LastErrorCode != "" {
		t.Fatal("client cancellation poisoned provider state")
	}
}
