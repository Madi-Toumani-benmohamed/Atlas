package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

func (s *Server) export(w http.ResponseWriter, r *http.Request, owner string) {
	tx, err := s.DB.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		dbFail(w, err)
		return
	}
	defer tx.Rollback()
	payload := map[string]any{"format": "atlas-catalog", "version": 1, "exported_at": time.Now().UTC(), "included": []string{"portfolios", "accounts", "assets"}, "not_included": []string{"operations", "prices", "fx"}}
	items, err := ReadExport(r.Context(), tx, owner)
	if err != nil {
		if errors.Is(err, ErrExportTooLarge) {
			fail(w, 413)
		} else {
			dbFail(w, err)
		}
		return
	}
	for key, v := range items {
		payload[key] = v
	}
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="atlas-catalog.json"`)
	reply(w, 200, payload)
}

var ErrExportTooLarge = errors.New("export_limit_32_mib")

func ReadExport(ctx context.Context, tx *sql.Tx, owner string) (map[string]any, error) {
	payload := map[string]any{}
	// Query templates are fixed; no user supplied identifier reaches SQL.
	queries := map[string]string{
		"portfolios": "SELECT row_to_json(t) FROM (SELECT id,name,archived,created_at FROM portfolios WHERE user_id=$1 ORDER BY id) t",
		"accounts":   "SELECT row_to_json(t) FROM (SELECT id,portfolio_id,name,kind,currency,provider,savings_product,archived,created_at FROM accounts WHERE user_id=$1 ORDER BY id) t",
		"assets":     "SELECT row_to_json(t) FROM (SELECT id,name,kind,symbol,namespace,reference,currency,archived,created_at FROM assets WHERE user_id=$1 ORDER BY id) t",
	}
	size := 0
	for key, query := range queries {
		rows, err := tx.QueryContext(ctx, query, owner)
		if err != nil {
			return nil, err
		}
		values := []json.RawMessage{}
		for rows.Next() {
			var raw []byte
			if err = rows.Scan(&raw); err != nil {
				rows.Close()
				return nil, err
			}
			size += len(raw)
			if size > 32<<20 {
				rows.Close()
				return nil, ErrExportTooLarge
			}
			values = append(values, json.RawMessage(raw))
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
		payload[key] = values
	}

	return payload, nil
}
