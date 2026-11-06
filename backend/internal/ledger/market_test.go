package ledger

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

const ecbFixture = `<Envelope><Cube><Cube time="2020-01-02"><Cube currency="USD" rate="1.1"/><Cube currency="GBP" rate="0.8"/></Cube></Cube></Envelope>`

func TestECBExactInverseAndCache(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.URL.RawQuery != "" {
			t.Error("private data sent to provider")
		}
		w.Write([]byte(ecbFixture))
	}))
	defer server.Close()
	p := &ECBProvider{URL: server.URL, Client: server.Client()}
	for i := 0; i < 2; i++ {
		rates, err := p.rates(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if len(rates) != 2 || rates[0].Value != "10/11" || rates[1].Value != "5/4" {
			t.Fatal("inexact FX inverse")
		}
	}
	if requests.Load() != 1 {
		t.Fatal("provider cache bypassed")
	}
}
func TestECBRejectsInvalidData(t *testing.T) {
	for _, raw := range []string{`<Envelope/>`, `<Envelope><Cube><Cube time="2020-01-02"><Cube currency="USD" rate="0"/></Cube></Cube></Envelope>`, `<Envelope><Cube><Cube time="2999-01-02"><Cube currency="USD" rate="1"/></Cube></Cube></Envelope>`} {
		if _, err := parseECB([]byte(raw)); err == nil {
			t.Fatal("invalid provider data accepted")
		}
	}
}
