package httpserver

import (
	"net/http/httptest"
	"testing"
)

func TestRoutes(t *testing.T) {
	for _, tc := range []struct {
		method, path string
		status       int
	}{
		{"GET", "/healthz", 200}, {"POST", "/healthz", 405}, {"GET", "/api/v1/portfolios", 404}, {"GET", "/", 404},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			Handler().ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
			if w.Code != tc.status {
				t.Fatalf("status %d, want %d", w.Code, tc.status)
			}
			if tc.status == 200 && (w.Body.String() != "{\"status\":\"ok\"}\n" || w.Header().Get("Cache-Control") != "no-store") {
				t.Fatal("invalid liveness response")
			}
		})
	}
}
