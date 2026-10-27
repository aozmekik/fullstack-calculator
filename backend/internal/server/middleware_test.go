package server

import (
	"bytes"
	"encoding/json/v2"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
)

func TestChainOrder(t *testing.T) {
	var calls []string
	record := func(name string) middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls = append(calls, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	handler := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { calls = append(calls, "handler") })

	chain(handler, record("outer"), record("inner")).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	if want := []string{"outer", "inner", "handler"}; !slices.Equal(calls, want) {
		t.Errorf("calls = %v, want %v", calls, want)
	}
}

func TestRequestID(t *testing.T) {
	tests := []struct {
		name     string
		inbound  string
		wantKept bool
	}{
		{"generated when absent", "", false},
		{"inbound ID is propagated", "checkout-42_a.b", true},
		{"overlong ID is replaced", strings.Repeat("a", 65), false},
		{"unsafe characters are replaced", "<script>", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var inContext string
			handler := requestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				inContext = requestIDFrom(r.Context())
			}))
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.inbound != "" {
				req.Header.Set(requestIDHeader, tt.inbound)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			got := rec.Header().Get(requestIDHeader)
			if got != inContext {
				t.Errorf("response ID %q differs from context ID %q", got, inContext)
			}
			if kept := got == tt.inbound; kept != tt.wantKept {
				t.Errorf("ID = %q, inbound %q kept = %v, want %v", got, tt.inbound, kept, tt.wantKept)
			}
			if !validRequestID.MatchString(got) {
				t.Errorf("ID %q is not a valid request ID", got)
			}
		})
	}
}

func TestLogRequests(t *testing.T) {
	tests := []struct {
		name      string
		handler   http.HandlerFunc
		wantLevel string
		wantCode  float64
		wantBytes float64
	}{
		{
			name: "explicit status",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusTeapot)
				_, _ = io.WriteString(w, "short and stout")
			},
			wantLevel: "INFO", wantCode: http.StatusTeapot, wantBytes: 15,
		},
		{
			name:      "implicit 200",
			handler:   func(w http.ResponseWriter, _ *http.Request) { _, _ = io.WriteString(w, "ok") },
			wantLevel: "INFO", wantCode: http.StatusOK, wantBytes: 2,
		},
		{
			name: "server errors log at error level",
			handler: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusInternalServerError)
				w.WriteHeader(http.StatusOK) // superfluous; the first status wins
			},
			wantLevel: "ERROR", wantCode: http.StatusInternalServerError, wantBytes: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var logs bytes.Buffer
			handler := chain(tt.handler, requestID, logRequests(slog.New(slog.NewJSONHandler(&logs, nil))))
			req := httptest.NewRequest(http.MethodPost, "/brew", nil)
			req.Header.Set(requestIDHeader, "req-1")
			handler.ServeHTTP(httptest.NewRecorder(), req)

			var entry map[string]any
			if err := json.Unmarshal(logs.Bytes(), &entry); err != nil {
				t.Fatalf("log line %q is not JSON: %v", logs.String(), err)
			}
			want := map[string]any{
				"level": tt.wantLevel, "msg": "request", "method": "POST", "path": "/brew",
				"status": tt.wantCode, "bytes": tt.wantBytes, "request_id": "req-1",
			}
			for key, value := range want {
				if entry[key] != value {
					t.Errorf("log %s = %v, want %v", key, entry[key], value)
				}
			}
			if _, ok := entry["duration"]; !ok {
				t.Error("log entry has no duration")
			}
		})
	}
}

// Wrapping the ResponseWriter must not hide optional interfaces such as Flusher.
func TestLogRequestsKeepsResponseControllerWorking(t *testing.T) {
	handler := logRequests(slog.New(slog.DiscardHandler))(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if err := http.NewResponseController(w).Flush(); err != nil {
			t.Errorf("Flush through the middleware: %v", err)
		}
	}))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if !rec.Flushed {
		t.Error("response was not flushed")
	}
}

func TestRecoverPanics(t *testing.T) {
	var logs bytes.Buffer
	handler := recoverPanics(slog.New(slog.NewJSONHandler(&logs, nil)))(
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
	if got, want := strings.TrimSpace(rec.Body.String()), `{"error":{"code":"internal_error","message":"internal server error"}}`; got != want {
		t.Errorf("body = %s, want %s", got, want)
	}
	if log := logs.String(); !strings.Contains(log, "panic serving request") || !strings.Contains(log, "boom") {
		t.Errorf("log = %q, want the panic and its value", log)
	}
}

func TestRecoverPanicsLetsAbortHandlerThrough(t *testing.T) {
	handler := recoverPanics(slog.New(slog.DiscardHandler))(
		http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic(http.ErrAbortHandler) }))

	defer func() {
		err, _ := recover().(error)
		if !errors.Is(err, http.ErrAbortHandler) {
			t.Errorf("recovered %v, want http.ErrAbortHandler", err)
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	t.Error("http.ErrAbortHandler was swallowed")
}

func TestWriteErrorHidesAndLogsUnexpectedErrors(t *testing.T) {
	var logs bytes.Buffer
	s := &server{logger: slog.New(slog.NewJSONHandler(&logs, nil))}
	rec := httptest.NewRecorder()

	s.writeError(rec, httptest.NewRequest(http.MethodGet, "/", nil), errors.New("disk on fire"))

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "disk on fire") {
		t.Errorf("body %q leaks the internal error", rec.Body.String())
	}
	if !strings.Contains(logs.String(), "disk on fire") {
		t.Errorf("log = %q, want the internal error", logs.String())
	}
}
