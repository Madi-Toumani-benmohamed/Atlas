package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthPaths(t *testing.T) {
	for _, tc := range []struct {
		path  string
		valid bool
	}{{"", true}, {"/healthz", true}, {"/readyz", true}, {"http://external.test", false}, {"//external.test", false}, {"/readyz?secret=x", false}} {
		_, valid := healthPath(tc.path)
		if valid != tc.valid {
			t.Fatalf("%s accepted=%v", tc.path, valid)
		}
	}
}
func TestHealthyRejectsWrongStatusBodyAndRedirect(t *testing.T) {
	targetCalls := 0
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { targetCalls++; w.Write([]byte("{\"status\":\"ok\"}\n")) }))
	defer target.Close()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ok":
			w.Write([]byte("{\"status\":\"ok\"}\n"))
		case "/bad":
			w.WriteHeader(503)
		case "/wrong":
			w.Write([]byte("{\"status\":\"ok\"}\nextra"))
		case "/redirect":
			http.Redirect(w, r, target.URL, 302)
		}
	}))
	defer server.Close()
	client := newHealthClient()
	for _, tc := range []struct {
		path string
		want bool
	}{{"/ok", true}, {"/bad", false}, {"/wrong", false}, {"/redirect", false}} {
		if healthy(client, server.URL+tc.path) != tc.want {
			t.Fatal(tc.path)
		}
	}
	if targetCalls != 0 {
		t.Fatal("healthcheck followed external redirect")
	}
}
