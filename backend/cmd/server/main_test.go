package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json/v2"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"testing"
)

// TestRun boots the real service on a free port, talks to it over HTTP and
// shuts it down the way a SIGTERM would.
func TestRun(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	logs, logWriter := io.Pipe()
	done := make(chan error, 1)
	go func() {
		err := run(ctx, env{"PORT": "0"}.get, logWriter)
		_ = logWriter.Close()
		done <- err
	}()
	entries := decodeLogs(logs)

	_, port, err := net.SplitHostPort(waitForLog(t, entries, "listening")["addr"].(string))
	if err != nil {
		t.Fatal(err)
	}
	base := "http://127.0.0.1:" + port

	if status, body := request(t, http.MethodGet, base+"/healthz", ""); status != http.StatusOK || body != `{"status":"ok"}` {
		t.Errorf("GET /healthz = %d %s", status, body)
	}
	status, body := request(t, http.MethodPost, base+"/api/v1/multiply", `{"operands":[6,7]}`)
	if want := `{"operation":"multiply","operands":[6,7],"result":42}`; status != http.StatusOK || body != want {
		t.Errorf("POST /api/v1/multiply = %d %s, want 200 %s", status, body, want)
	}

	cancel()
	waitForLog(t, entries, "stopped")
	if err := <-done; err != nil {
		t.Fatalf("run() = %v after shutdown, want nil", err)
	}
}

func TestRunRejectsInvalidConfig(t *testing.T) {
	err := run(t.Context(), env{"PORT": "http"}.get, io.Discard)
	if err == nil || !strings.Contains(err.Error(), "PORT") {
		t.Fatalf("run() = %v, want a PORT configuration error", err)
	}
}

func TestServeReportsServeErrors(t *testing.T) {
	var lc net.ListenConfig
	ln, err := lc.Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	_ = ln.Close()

	srv := newHTTPServer(http.NotFoundHandler(), slog.New(slog.DiscardHandler))
	if err := serve(t.Context(), srv, ln); err == nil {
		t.Fatal("serve() on a closed listener succeeded, want an error")
	}
}

func TestNewLogger(t *testing.T) {
	tests := []struct{ format, want string }{
		{"json", `"msg":"hello"`},
		{"text", `msg=hello`},
	}
	for _, tt := range tests {
		var out bytes.Buffer
		newLogger(tt.format, &out).Info("hello")
		if !strings.Contains(out.String(), tt.want) {
			t.Errorf("%s logger wrote %q, want it to contain %q", tt.format, out.String(), tt.want)
		}
	}
}

// decodeLogs streams JSON log lines from r as decoded entries.
func decodeLogs(r io.Reader) <-chan map[string]any {
	entries := make(chan map[string]any, 16)
	go func() {
		defer close(entries)
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			var entry map[string]any
			if json.Unmarshal(scanner.Bytes(), &entry) == nil {
				entries <- entry
			}
		}
	}()
	return entries
}

func waitForLog(t *testing.T, entries <-chan map[string]any, msg string) map[string]any {
	t.Helper()
	for entry := range entries {
		if entry["msg"] == msg {
			return entry
		}
	}
	t.Fatalf("log message %q never appeared", msg)
	return nil
}

func request(t *testing.T, method, url, body string) (int, string) {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), method, url, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, strings.TrimSpace(string(b))
}
