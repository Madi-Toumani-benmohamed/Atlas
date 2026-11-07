// Command healthcheck probes the configured local liveness/readiness endpoint.
package main

import (
	"io"
	"net/http"
	"os"
	"time"
)

func healthy(client *http.Client, endpoint string) bool {
	response, err := client.Get(endpoint)
	if err != nil {
		return false
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 128))
	return err == nil && response.StatusCode == http.StatusOK && string(body) == "{\"status\":\"ok\"}\n"
}
func healthPath(value string) (string, bool) {
	if value == "" {
		return "/healthz", true
	}
	return value, value == "/healthz" || value == "/readyz"
}
func newHealthClient() *http.Client {
	return &http.Client{Timeout: 3 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}
func main() {
	path, valid := healthPath(os.Getenv("ATLAS_HEALTHCHECK_PATH"))
	if !valid {
		os.Exit(1)
	}
	client := newHealthClient()
	if !healthy(client, "http://127.0.0.1:8080"+path) {
		os.Exit(1)
	}
}
