package main

import (
	"atlas.local/backend/internal/catalog"
	"atlas.local/backend/internal/httpserver"
	"atlas.local/backend/internal/identity"
	"atlas.local/backend/internal/ledger"
	"context"
	"database/sql"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
	addr := os.Getenv("ATLAS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	var auth []*identity.Server
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		origin := os.Getenv("ATLAS_ORIGIN")
		u, err := url.Parse(origin)
		insecure := os.Getenv("ATLAS_INSECURE_HTTP") == "true"
		if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" || (u.Scheme != "https" && !(insecure && u.Scheme == "http")) {
			log.Fatal("ATLAS_ORIGIN must be an HTTPS origin; local HTTP requires ATLAS_INSECURE_HTTP=true")
		}
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			log.Fatal("database configuration failed")
		}
		defer db.Close()
		db.SetMaxOpenConns(10)
		db.SetConnMaxLifetime(30 * time.Minute)
		initCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		err = identity.Migrate(initCtx, db)
		if err == nil {
			err = catalog.Migrate(initCtx, db)
		}
		if err == nil {
			err = ledger.Migrate(initCtx, db)
		}
		cancel()
		if err != nil {
			log.Fatal("database migration failed")
		}
		auth = append(auth, identity.New(db, origin, u.Scheme == "https", os.Getenv("ATLAS_REGISTRATION") == "true"))
	}
	webDir := os.Getenv("ATLAS_WEB_DIR")
	if webDir != "" {
		if info, err := os.Stat(filepath.Join(webDir, "index.html")); err != nil || !info.Mode().IsRegular() {
			log.Fatal("ATLAS_WEB_DIR must contain the built index.html")
		}
	}
	srv := &http.Server{Addr: addr, Handler: httpserver.HandlerWithWeb(webDir, auth...), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdown); err != nil {
			log.Print("shutdown failed")
			srv.Close()
		}
	}()
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
