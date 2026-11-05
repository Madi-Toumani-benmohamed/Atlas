package httpserver

import (
	"atlas.local/backend/internal/identity"
	"net/http"
)

// Handler exposes process liveness only, not database or product readiness.
func Handler(auth ...*identity.Server) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Write([]byte("{\"status\":\"ok\"}\n"))
	})
	if len(auth) > 0 {
		auth[0].RegisterRoutes(mux)
	}
	return mux
}
