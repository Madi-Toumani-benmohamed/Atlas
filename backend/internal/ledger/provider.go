package ledger

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const ecbCacheTTL = 6 * time.Hour

// ECBProvider contains only public reference data. No owner, position, rate
// preference or session is stored in the shared cache or emitted in its logs.
type ECBProvider struct {
	Client                         *http.Client
	URL                            string
	mu                             sync.Mutex
	fetchMu                        sync.Mutex
	cached                         []FXRate
	fetched                        time.Time
	attempted, failed, nextAllowed time.Time
	refreshing                     bool
	failures                       int
	lastError                      string
	logger                         *slog.Logger
}
type providerFailure struct{ code, retryAfter string }

func (e *providerFailure) Error() string { return e.code }
func (p *ECBProvider) availableLocked(now time.Time) ([]FXRate, error, bool) {
	if now.Sub(p.fetched) < ecbCacheTTL && len(p.cached) > 0 {
		return append([]FXRate(nil), p.cached...), nil, true
	}
	if now.Before(p.nextAllowed) {
		return nil, errors.New("ecb_backoff"), true
	}
	return nil, nil, false
}
func (p *ECBProvider) rates(ctx context.Context) ([]FXRate, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	p.mu.Lock()
	rates, err, available := p.availableLocked(time.Now())
	p.mu.Unlock()
	if available {
		return rates, err
	}
	p.fetchMu.Lock()
	defer p.fetchMu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	p.mu.Lock()
	rates, err, available = p.availableLocked(time.Now())
	if available {
		p.mu.Unlock()
		return rates, err
	}
	p.refreshing = true
	p.attempted = time.Now()
	p.mu.Unlock()
	rates, err = p.fetch(ctx)
	finished := time.Now()
	outcome, code := "success", ""
	p.mu.Lock()
	p.refreshing = false
	if err == nil {
		p.cached = append([]FXRate(nil), rates...)
		p.fetched = finished
		p.failures = 0
		p.lastError = ""
		p.nextAllowed = time.Time{}
	} else if ctx.Err() != nil {
		outcome, code = "cancelled", "request_cancelled"
	} else {
		outcome, code = "failure", err.Error()
		p.failed = finished
		p.lastError = code
		if p.failures < 7 {
			p.failures++
		}
		hint := ""
		var failure *providerFailure
		if errors.As(err, &failure) {
			hint = failure.retryAfter
		}
		p.nextAllowed = finished.Add(providerRetryDelay(p.failures, hint, finished))
	}
	p.mu.Unlock()
	logger := p.logger
	if logger == nil {
		logger = slog.Default()
	}
	// Never pass driver/client errors, URLs, response bodies or private IDs here.
	if outcome == "failure" {
		logger.Warn("market_provider_fetch", "source", "ECB", "outcome", outcome, "error_code", code)
	} else {
		logger.Info("market_provider_fetch", "source", "ECB", "outcome", outcome, "error_code", code)
	}
	if err != nil {
		return nil, err
	}
	return append([]FXRate(nil), rates...), nil
}
func (p *ECBProvider) fetch(ctx context.Context) ([]FXRate, error) {
	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	endpoint := p.URL
	if endpoint == "" {
		endpoint = ecbURL
	}
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 6 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("provider_redirect_refused") }}
	}
	request, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, &providerFailure{code: "ecb_unavailable"}
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, &providerFailure{code: "ecb_unavailable"}
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		code := "ecb_unavailable"
		if response.StatusCode == http.StatusTooManyRequests {
			code = "ecb_rate_limited"
		}
		return nil, &providerFailure{code: code, retryAfter: response.Header.Get("Retry-After")}
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, (512<<10)+1))
	if err != nil || len(raw) > 512<<10 {
		return nil, &providerFailure{code: "invalid_ecb_response"}
	}
	return parseECB(raw)
}
func providerRetryDelay(failures int, hint string, now time.Time) time.Duration {
	if failures < 1 {
		failures = 1
	}
	if failures > 7 {
		failures = 7
	}
	delay := 30 * time.Second * time.Duration(1<<uint(failures-1))
	if delay > 30*time.Minute {
		delay = 30 * time.Minute
	}
	hinted := time.Duration(0)
	if seconds, err := strconv.ParseInt(strings.TrimSpace(hint), 10, 64); err == nil {
		if seconds > 3600 {
			seconds = 3600
		}
		if seconds > 0 {
			hinted = time.Duration(seconds) * time.Second
		}
	} else if date, err := http.ParseTime(hint); err == nil {
		hinted = date.Sub(now)
	}
	if hinted > time.Hour {
		hinted = time.Hour
	}
	if hinted > delay {
		delay = hinted
	}
	return delay
}

type providerSnapshot struct {
	Source            string     `json:"source"`
	State             string     `json:"state"`
	CacheTTLSeconds   int        `json:"cache_ttl_seconds"`
	LastAttemptAt     *time.Time `json:"last_attempt_at"`
	LastSuccessAt     *time.Time `json:"last_success_at"`
	LastFailureAt     *time.Time `json:"last_failure_at"`
	CacheExpiresAt    *time.Time `json:"cache_expires_at"`
	NextRequestAt     *time.Time `json:"next_request_at"`
	RetryAfterSeconds int64      `json:"retry_after_seconds"`
	ReferenceDate     string     `json:"reference_date,omitempty"`
	LastErrorCode     string     `json:"last_error_code,omitempty"`
}

func optionalTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	v := t.UTC()
	return &v
}
func (p *ECBProvider) snapshot(now time.Time) providerSnapshot {
	p.mu.Lock()
	defer p.mu.Unlock()
	state := "never_fetched"
	if len(p.cached) > 0 {
		state = "stale"
		if now.Sub(p.fetched) < ecbCacheTTL {
			state = "cached"
		}
	} else if p.lastError != "" {
		state = "unavailable"
	}
	if now.Before(p.nextAllowed) {
		state = "backoff"
	}
	if p.refreshing {
		state = "refreshing"
	}
	snapshot := providerSnapshot{Source: "ECB", State: state, CacheTTLSeconds: int(ecbCacheTTL / time.Second), LastAttemptAt: optionalTime(p.attempted), LastSuccessAt: optionalTime(p.fetched), LastFailureAt: optionalTime(p.failed), LastErrorCode: p.lastError}
	if len(p.cached) > 0 {
		snapshot.ReferenceDate = p.cached[0].ReferenceDate
		snapshot.CacheExpiresAt = optionalTime(p.fetched.Add(ecbCacheTTL))
		if now.Before(p.fetched.Add(ecbCacheTTL)) {
			snapshot.NextRequestAt = snapshot.CacheExpiresAt
		}
	}
	if now.Before(p.nextAllowed) {
		snapshot.NextRequestAt = optionalTime(p.nextAllowed)
		snapshot.RetryAfterSeconds = int64((p.nextAllowed.Sub(now) + time.Second - 1) / time.Second)
	}
	return snapshot
}
func (s *Server) marketStatus(w http.ResponseWriter, r *http.Request, owner string) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	var last sql.NullTime
	var reference sql.NullString
	if err := s.DB.QueryRowContext(ctx, "SELECT max(observed_at),max(reference_date)::text FROM price_observations WHERE user_id=$1 AND source_type='ecb'", owner).Scan(&last, &reference); err != nil {
		dbFail(w, err)
		return
	}
	var persisted *time.Time
	if last.Valid {
		persisted = optionalTime(last.Time)
	}
	reply(w, 200, map[string]any{"provider": s.ECB.snapshot(time.Now()), "synchronization": map[string]any{"last_persisted_at": persisted, "reference_date": reference.String}, "policy": "shared_cache_6h_bounded_failure_backoff", "automatic_asset_prices": false})
}
