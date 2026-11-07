package httpserver

import (
	"atlas.local/backend/internal/catalog"
	"atlas.local/backend/internal/identity"
	"atlas.local/backend/internal/ledger"
	"context"
	"net/http"
)

// Handler assembles routes with separate process and database readiness probes.
func Handler(auth ...*identity.Server) http.Handler {
	return HandlerWithWeb("", auth...)
}

func HandlerWithWeb(webDir string, auth ...*identity.Server) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Write([]byte("{\"status\":\"ok\"}\n"))
	})
	var ping func(context.Context) error
	if len(auth) > 0 && auth[0] != nil && auth[0].DB != nil {
		ping = auth[0].DB.PingContext
	}
	mux.Handle("GET /readyz", newReadiness(ping))
	if len(auth) > 0 && auth[0] != nil {
		auth[0].RegisterRoutes(mux)
		(&catalog.Server{DB: auth[0].DB, Auth: auth[0]}).RegisterRoutes(mux)
		(&ledger.Server{DB: auth[0].DB, Auth: auth[0]}).RegisterRoutes(mux)
	}
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(404)
		w.Write([]byte(`{"error":"not_found"}`))
	})
	if webDir != "" {
		files := staticFiles(webDir)
		mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet && r.Method != http.MethodHead {
				w.Header().Set("Allow", "GET, HEAD")
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			files.ServeHTTP(w, r)
		}))
	}
	return mux
}
