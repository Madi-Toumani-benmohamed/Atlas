package main

import (
	"atlas.local/backend/internal/httpserver"
	"atlas.local/backend/internal/identity"
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
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
		cancel()
		if err != nil {
			log.Fatal("database migration failed")
		}
		auth = append(auth, identity.New(db, origin, u.Scheme == "https", os.Getenv("ATLAS_REGISTRATION") == "true"))
	}
	srv := &http.Server{Addr: addr, Handler: httpserver.Handler(auth...), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
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
