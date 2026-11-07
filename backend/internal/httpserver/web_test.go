package httpserver

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"syscall"
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

func TestStaticBuildConfinement(t *testing.T) {
	dir := t.TempDir()
	outside := t.TempDir()
	const secret = "synthetic-private-content-must-never-be-served"
	for _, file := range []string{filepath.Join(outside, "private.txt"), filepath.Join(dir, ".env")} {
		if err := os.WriteFile(file, []byte(secret), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(dir, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	for link, target := range map[string]string{
		"leak.txt":          filepath.Join(outside, "private.txt"),
		"assets/nested.txt": filepath.Join(outside, "private.txt"),
		"outside":           outside,
		"hidden.txt":        ".env",
		"hidden-dir":        outside,
	} {
		if err := os.Symlink(target, filepath.Join(dir, link)); err != nil {
			t.Fatal(err)
		}
	}
	handler := staticFiles(dir)
	for _, requestPath := range []string{"/", "/leak.txt", "/assets/nested.txt", "/outside/private.txt", "/hidden.txt", "/.env", "/%2eenv", "/assets/", "/../private.txt", "/%2e%2e/private.txt"} {
		t.Run(requestPath, func(t *testing.T) {
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, httptest.NewRequest("GET", requestPath, nil))
			if w.Code != 404 || strings.Contains(w.Body.String(), secret) {
				t.Fatalf("private path served: status %d", w.Code)
			}
			if w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Fatal("unsafe refusal headers")
			}
		})
	}
}

func TestStaticContentHeadAndRange(t *testing.T) {
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	const content = "export const synthetic=true;"
	if err := os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	handler := staticFiles(dir)
	for _, tc := range []struct {
		method, span, body string
		status             int
	}{
		{"GET", "", content, 200}, {"HEAD", "", "", 200}, {"GET", "bytes=0-5", "export", 206},
	} {
		r := httptest.NewRequest(tc.method, "/assets/app.js", nil)
		if tc.span != "" {
			r.Header.Set("Range", tc.span)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.status || w.Body.String() != tc.body {
			t.Fatalf("public content regression: %s %s status %d", tc.method, tc.span, w.Code)
		}
		if w.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
			t.Fatal("hashed asset cache changed")
		}
	}
}

func TestStaticRejectsSpecialFiles(t *testing.T) {
	dir := t.TempDir()
	if err := syscall.Mkfifo(filepath.Join(dir, "pipe"), 0600); err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	staticFiles(dir).ServeHTTP(w, httptest.NewRequest("GET", "/pipe", nil))
	if w.Code != 404 {
		t.Fatalf("FIFO served: status %d", w.Code)
	}
}
