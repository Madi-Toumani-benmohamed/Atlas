package httpserver

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestProductionWeb(t *testing.T) {
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	for name, body := range map[string]string{"index.html": "<!doctype html><html lang=\"fr\"><title>Atlas</title></html>", "assets/app.js": "export const synthetic=true"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0644); err != nil {
			t.Fatal(err)
		}
	}
	handler := HandlerWithWeb(dir)
	for _, tc := range []struct {
		method, path string
		status       int
	}{{"GET", "/", 200}, {"HEAD", "/", 200}, {"GET", "/assets/app.js", 200}, {"GET", "/assets/", 404}, {"GET", "/.env", 404}, {"GET", "/api/v1/unknown", 404}, {"GET", "/unknown", 404}, {"GET", "/healthz", 200}} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
			if w.Code != tc.status {
				t.Fatalf("got %d want %d", w.Code, tc.status)
			}
			if tc.path == "/" && (!strings.Contains(w.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") || w.Header().Get("Cache-Control") != "no-store") {
				t.Fatal("unsafe index headers")
			}
			if tc.path == "/api/v1/unknown" && !strings.Contains(w.Header().Get("Content-Type"), "application/json") {
				t.Fatal("API fell back to HTML")
			}
		})
	}
}
