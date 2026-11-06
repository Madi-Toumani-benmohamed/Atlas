package ledger

import (
	"context"
	_ "embed"
	"encoding/xml"
	"errors"
	"io"
	"math/big"
	"net/http"
	"regexp"
	"sync"
	"time"
)

//go:embed market-schema.sql
var marketSchema string

const ecbURL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"

type FXRate struct{ Currency, ReferenceDate, Value string }

// ECBProvider caches only public reference rates, never users' portfolios.
type ECBProvider struct {
	Client  *http.Client
	URL     string
	mu      sync.Mutex
	cached  []FXRate
	fetched time.Time
}

func (p *ECBProvider) rates(ctx context.Context) ([]FXRate, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if time.Since(p.fetched) < 6*time.Hour && len(p.cached) > 0 {
		return append([]FXRate(nil), p.cached...), nil
	}
	endpoint := p.URL
	if endpoint == "" {
		endpoint = ecbURL
	}
	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 6 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("provider_redirect_refused") }}
	}
	request, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, errors.New("ecb_unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, errors.New("ecb_unavailable")
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, (512<<10)+1))
	if err != nil || len(raw) > 512<<10 {
		return nil, errors.New("invalid_ecb_response")
	}
	out, err := parseECB(raw)
	if err != nil {
		return nil, err
	}
	p.cached = out
	p.fetched = time.Now()
	return append([]FXRate(nil), out...), nil
}
func parseECB(raw []byte) ([]FXRate, error) {
	var envelope struct {
		Cube struct {
			Days []struct {
				Time  string `xml:"time,attr"`
				Rates []struct {
					Currency string `xml:"currency,attr"`
					Rate     string `xml:"rate,attr"`
				} `xml:"Cube"`
			} `xml:"Cube"`
		} `xml:"Cube"`
	}
	if err := xml.Unmarshal(raw, &envelope); err != nil {
		return nil, errors.New("invalid_ecb_xml")
	}
	if len(envelope.Cube.Days) != 1 {
		return nil, errors.New("invalid_ecb_reference_date")
	}
	day := envelope.Cube.Days[0]
	date, err := time.Parse("2006-01-02", day.Time)
	if err != nil || date.After(time.Now()) {
		return nil, errors.New("invalid_ecb_reference_date")
	}
	out := []FXRate{}
	seen := map[string]bool{}
	for _, rate := range day.Rates {
		n, err := number(rate.Rate)
		if err != nil || n.Sign() <= 0 || !regexp.MustCompile(`^[A-Z]{3}$`).MatchString(rate.Currency) || rate.Currency == "EUR" || seen[rate.Currency] {
			return nil, errors.New("invalid_ecb_rate")
		}
		seen[rate.Currency] = true
		out = append(out, FXRate{rate.Currency, day.Time, new(big.Rat).Inv(n).RatString()})
	}
	if len(out) == 0 {
		return nil, errors.New("empty_ecb_response")
	}
	return out, nil
}
func (s *Server) refreshFX(w http.ResponseWriter, r *http.Request, owner string) {
	var in struct{}
	if !decode(w, r, &in) {
		return
	}
	rates, err := s.ECB.rates(r.Context())
	if err != nil {
		fail(w, 503, "ecb_unavailable_manual_rates_preserved")
		return
	}
	tx, err := s.DB.BeginTx(r.Context(), nil)
	if err != nil {
		dbFail(w, err)
		return
	}
	defer tx.Rollback()
	received := time.Now().UTC()
	updated := int64(0)
	for _, rate := range rates {
		result, err := tx.ExecContext(r.Context(), "INSERT INTO price_observations(id,user_id,currency,value,observed_at,source,source_type,reference_date) VALUES($1,$2,$3,$4,$5,$6,'ecb',$7) ON CONFLICT DO NOTHING", token(), owner, rate.Currency, rate.Value, received, "BCE · taux de référence "+rate.ReferenceDate+" · inverse exact vers EUR", rate.ReferenceDate)
		if err != nil {
			dbFail(w, err)
			return
		}
		n, _ := result.RowsAffected()
		updated += n
	}
	if err = tx.Commit(); err != nil {
		dbFail(w, err)
		return
	}
	reply(w, 200, map[string]any{"updated": updated, "source": "ECB", "reference_date": rates[0].ReferenceDate, "received_at": received, "kind": "reference_rate_not_transaction_rate", "attribution_url": "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html"})
}
func observationNumber(s string) *big.Rat {
	n, ok := new(big.Rat).SetString(s)
	if !ok || n.Sign() <= 0 {
		return nil
	}
	return n
}
