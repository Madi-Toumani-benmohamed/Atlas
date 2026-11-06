package httpserver

import (
	"context"
	"net/http"
	"sync"
	"time"
)

// readinessProbe shares one bounded DB probe across bursts of anonymous checks.
// Only the generic result is public; failures never serialize driver errors.
type readinessProbe struct {
	mu           sync.Mutex
	ping         func(context.Context) error
	now          func() time.Time
	timeout, ttl time.Duration
	expires      time.Time
	ready        bool
}

func newReadiness(ping func(context.Context) error) *readinessProbe {
	return &readinessProbe{ping: ping, now: time.Now, timeout: time.Second, ttl: 5 * time.Second}
}
func (p *readinessProbe) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	now := p.now()
	if !now.Before(p.expires) {
		p.ready = false
		if p.ping != nil {
			// A disconnected observer must not poison the shared readiness cache.
			ctx, cancel := context.WithTimeout(context.Background(), p.timeout)
			p.ready = p.ping(ctx) == nil
			cancel()
		}
		p.expires = p.now().Add(p.ttl)
	}
	ready := p.ready
	p.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if !ready {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte("{\"status\":\"unavailable\"}\n"))
		return
	}
	w.Write([]byte("{\"status\":\"ok\"}\n"))
}
