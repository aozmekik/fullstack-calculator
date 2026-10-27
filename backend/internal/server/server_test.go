package server_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aozmekik/fullstack-calculator/backend/internal/server"
)

// noContentType marks a request sent without a Content-Type header.
const noContentType = "none"

// TestAPI pins the HTTP contract: every response a client can get, byte for byte.
func TestAPI(t *testing.T) {
	handler := server.New(server.Options{})

	tests := []struct {
		name        string
		method      string // default POST
		path        string
		contentType string // default application/json
		body        string
		wantStatus  int
		wantBody    string
		wantAllow   string
	}{
		// Successful calculations.
		{name: "add", path: "/api/v1/add", body: `{"operands":[2,3]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"add","operands":[2,3],"result":5}`},
		{name: "subtract", path: "/api/v1/subtract", body: `{"operands":[10,4]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"subtract","operands":[10,4],"result":6}`},
		{name: "multiply", path: "/api/v1/multiply", body: `{"operands":[6,7]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"multiply","operands":[6,7],"result":42}`},
		{name: "divide", path: "/api/v1/divide", body: `{"operands":[10,4]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"divide","operands":[10,4],"result":2.5}`},
		{name: "power", path: "/api/v1/power", body: `{"operands":[2,10]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"power","operands":[2,10],"result":1024}`},
		{name: "sqrt", path: "/api/v1/sqrt", body: `{"operands":[16]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"sqrt","operands":[16],"result":4}`},
		{name: "percentage", path: "/api/v1/percentage", body: `{"operands":[15,200]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"percentage","operands":[15,200],"result":30}`},
		{name: "binary rounding noise is removed", path: "/api/v1/add", body: `{"operands":[0.1,0.2]}`,
			wantStatus: http.StatusOK, wantBody: `{"operation":"add","operands":[0.1,0.2],"result":0.3}`},
		{name: "media type parameters are accepted", path: "/api/v1/add", body: `{"operands":[1,2]}`,
			contentType: "application/json; charset=utf-8",
			wantStatus:  http.StatusOK, wantBody: `{"operation":"add","operands":[1,2],"result":3}`},
		{name: "media type is case-insensitive", path: "/api/v1/add", body: `{"operands":[1,2]}`,
			contentType: "Application/JSON",
			wantStatus:  http.StatusOK, wantBody: `{"operation":"add","operands":[1,2],"result":3}`},
		{name: "surrounding whitespace is fine", path: "/api/v1/add", body: " \n {\"operands\":[1,2]} \n",
			wantStatus: http.StatusOK, wantBody: `{"operation":"add","operands":[1,2],"result":3}`},
		{name: "body at the size limit", path: "/api/v1/add", body: padTo(`{"operands":[1,2]}`, 4096),
			wantStatus: http.StatusOK, wantBody: `{"operation":"add","operands":[1,2],"result":3}`},

		// 400: the request is malformed.
		{name: "empty body", path: "/api/v1/add", body: ``,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"request body is empty; expected a JSON object"}}`},
		{name: "truncated JSON", path: "/api/v1/add", body: `{`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"malformed JSON at byte 1: unexpected EOF"}}`},
		{name: "body is an array", path: "/api/v1/add", body: `[]`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"request body must be a JSON object"}}`},
		{name: "body is null", path: "/api/v1/add", body: `null`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"request body must be a JSON object"}}`},
		{name: "operands missing", path: "/api/v1/add", body: `{}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"wrong number of operands: add takes 2, got 0"}}`},
		{name: "operands null", path: "/api/v1/add", body: `{"operands":null}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"wrong number of operands: add takes 2, got 0"}}`},
		{name: "null operand is not zero", path: "/api/v1/add", body: `{"operands":[null,1]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"operands[0] must be a number, not null"}}`},
		{name: "string operand", path: "/api/v1/add", body: `{"operands":["1",2]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"operands[0] must be a number"}}`},
		{name: "boolean operand", path: "/api/v1/add", body: `{"operands":[1,true]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"operands[1] must be a number"}}`},
		{name: "operands not an array", path: "/api/v1/add", body: `{"operands":"12"}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"operands must be an array"}}`},
		{name: "NaN is not JSON", path: "/api/v1/add", body: `{"operands":[NaN,1]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"malformed JSON at byte 13: invalid character 'N' at start of value"}}`},
		{name: "leading zeros are not JSON", path: "/api/v1/add", body: `{"operands":[01,1]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"malformed JSON at byte 14: invalid character '1' after array element (expecting ',' or ']')"}}`},
		{name: "number beyond float64", path: "/api/v1/add", body: `{"operands":[1e400,1]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"operands[0] is outside the range of a 64-bit float"}}`},
		{name: "a number where the array goes", path: "/api/v1/add", body: `{"operands":5}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"operands must be an array"}}`},
		{name: "body is a number", path: "/api/v1/add", body: `5`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"request body must be a JSON object"}}`},
		{name: "unknown field", path: "/api/v1/add", body: `{"operands":[1,2],"extra":true}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"unknown field \"extra\""}}`},
		{name: "field names are case-sensitive", path: "/api/v1/add", body: `{"OPERANDS":[1,2]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"unknown field \"OPERANDS\""}}`},
		{name: "duplicate field", path: "/api/v1/add", body: `{"operands":[1],"operands":[2]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"duplicate field \"operands\""}}`},
		{name: "trailing data", path: "/api/v1/add", body: `{"operands":[1,2]} {}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"malformed JSON at byte 19: invalid character '{' after top-level value"}}`},
		{name: "too few operands", path: "/api/v1/add", body: `{"operands":[1]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"wrong number of operands: add takes 2, got 1"}}`},
		{name: "too many operands", path: "/api/v1/sqrt", body: `{"operands":[1,2]}`,
			wantStatus: http.StatusBadRequest, wantBody: `{"error":{"code":"invalid_request","message":"wrong number of operands: sqrt takes 1, got 2"}}`},

		// 404, 405: routing errors win over body and header checks.
		{name: "unsupported operation", path: "/api/v1/modulo", contentType: noContentType,
			wantStatus: http.StatusNotFound, wantBody: `{"error":{"code":"not_found","message":"no route for POST /api/v1/modulo"}}`},
		{name: "trailing slash", path: "/api/v1/add/", body: `{"operands":[1,2]}`,
			wantStatus: http.StatusNotFound, wantBody: `{"error":{"code":"not_found","message":"no route for POST /api/v1/add/"}}`},
		{name: "no frontend without a static dir", method: http.MethodGet, path: "/",
			wantStatus: http.StatusNotFound, wantBody: `{"error":{"code":"not_found","message":"no route for GET /"}}`},
		{name: "GET on an operation", method: http.MethodGet, path: "/api/v1/add", contentType: noContentType,
			wantStatus: http.StatusMethodNotAllowed, wantAllow: "POST",
			wantBody: `{"error":{"code":"method_not_allowed","message":"method GET is not allowed; use POST"}}`},
		{name: "DELETE on an operation", method: http.MethodDelete, path: "/api/v1/divide",
			wantStatus: http.StatusMethodNotAllowed, wantAllow: "POST",
			wantBody: `{"error":{"code":"method_not_allowed","message":"method DELETE is not allowed; use POST"}}`},
		{name: "POST on the health check", path: "/healthz",
			wantStatus: http.StatusMethodNotAllowed, wantAllow: "GET, HEAD",
			wantBody: `{"error":{"code":"method_not_allowed","message":"method POST is not allowed; use GET, HEAD"}}`},

		// 413, 415: the request is not something the API reads.
		{name: "body over the size limit", path: "/api/v1/add", body: padTo(`{"operands":[1,2]}`, 4097),
			wantStatus: http.StatusRequestEntityTooLarge, wantBody: `{"error":{"code":"payload_too_large","message":"request body must not exceed 4096 bytes"}}`},
		{name: "missing Content-Type", path: "/api/v1/add", contentType: noContentType, body: `{"operands":[1,2]}`,
			wantStatus: http.StatusUnsupportedMediaType, wantBody: `{"error":{"code":"unsupported_media_type","message":"Content-Type must be application/json"}}`},
		{name: "wrong Content-Type", path: "/api/v1/add", contentType: "text/plain", body: `{"operands":[1,2]}`,
			wantStatus: http.StatusUnsupportedMediaType, wantBody: `{"error":{"code":"unsupported_media_type","message":"Content-Type must be application/json"}}`},

		// 422: well-formed, but the math has no answer.
		{name: "division by zero", path: "/api/v1/divide", body: `{"operands":[1,0]}`,
			wantStatus: http.StatusUnprocessableEntity, wantBody: `{"error":{"code":"division_by_zero","message":"division by zero"}}`},
		{name: "zero to a negative power", path: "/api/v1/power", body: `{"operands":[0,-1]}`,
			wantStatus: http.StatusUnprocessableEntity, wantBody: `{"error":{"code":"division_by_zero","message":"division by zero: zero raised to a negative power"}}`},
		{name: "square root of a negative", path: "/api/v1/sqrt", body: `{"operands":[-4]}`,
			wantStatus: http.StatusUnprocessableEntity, wantBody: `{"error":{"code":"not_a_real_number","message":"result is not a real number: square root of a negative number"}}`},
		{name: "negative base, fractional exponent", path: "/api/v1/power", body: `{"operands":[-8,0.5]}`,
			wantStatus: http.StatusUnprocessableEntity, wantBody: `{"error":{"code":"not_a_real_number","message":"result is not a real number: negative base with a fractional exponent"}}`},
		{name: "overflow", path: "/api/v1/multiply", body: `{"operands":[1e308,10]}`,
			wantStatus: http.StatusUnprocessableEntity, wantBody: `{"error":{"code":"result_out_of_range","message":"result is out of range: magnitude exceeds 1.7976931348623157e+308"}}`},

		// Health check.
		{name: "health", method: http.MethodGet, path: "/healthz",
			wantStatus: http.StatusOK, wantBody: `{"status":"ok"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := send(handler, tt.method, tt.path, tt.contentType, tt.body)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if got := strings.TrimSuffix(rec.Body.String(), "\n"); got != tt.wantBody {
				t.Errorf("body = %s\nwant   %s", got, tt.wantBody)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}
			if got := rec.Header().Get("Allow"); got != tt.wantAllow {
				t.Errorf("Allow = %q, want %q", got, tt.wantAllow)
			}
		})
	}
}

// An oversized body must also close the connection; otherwise the server keeps
// reading the rest of the body to reuse the connection.
func TestOversizedBodyClosesTheConnection(t *testing.T) {
	srv := httptest.NewServer(server.New(server.Options{}))
	defer srv.Close()

	body := strings.NewReader(padTo(`{"operands":[1,2]}`, 5000))
	req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, srv.URL+"/api/v1/add", body)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want 413", resp.StatusCode)
	}
	if !resp.Close {
		t.Error("the connection stays open after a 413")
	}
}

func TestHealthHead(t *testing.T) {
	srv := httptest.NewServer(server.New(server.Options{}))
	defer srv.Close()

	req, err := http.NewRequestWithContext(t.Context(), http.MethodHead, srv.URL+"/healthz", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("HEAD /healthz status = %d, want 200", resp.StatusCode)
	}
}

func TestResponseHeaders(t *testing.T) {
	handler := server.New(server.Options{})

	rec := send(handler, http.MethodGet, "/healthz", "", "")
	for name, want := range map[string]string{
		"Content-Security-Policy": "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
		"Referrer-Policy":         "no-referrer",
		"X-Content-Type-Options":  "nosniff",
	} {
		if got := rec.Header().Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
	if rec.Header().Get("X-Request-ID") == "" {
		t.Error("X-Request-ID is missing")
	}
}

func TestStaticFiles(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "index.html"), "<!doctype html><title>Calculator</title>")
	writeFile(t, filepath.Join(dir, "assets", "index-abc123.js"), "console.log('hi')")
	handler := server.New(server.Options{StaticDir: dir})

	tests := []struct {
		name             string
		method, path     string
		wantStatus       int
		wantCacheControl string
		wantBodyPrefix   string
	}{
		{"index page", http.MethodGet, "/", http.StatusOK, "no-cache", "<!doctype html>"},
		{"fingerprinted asset", http.MethodGet, "/assets/index-abc123.js", http.StatusOK, "public, max-age=31536000, immutable", "console.log"},
		{"no directory listing", http.MethodGet, "/assets/", http.StatusNotFound, "", "404 page not found"},
		// http.FileServer strips caching headers from error responses.
		{"missing file", http.MethodGet, "/missing.txt", http.StatusNotFound, "", "404 page not found"},
		{"read-only", http.MethodPost, "/", http.StatusMethodNotAllowed, "", "Method Not Allowed"},
		{"API routes still win", http.MethodGet, "/api/v1/nope", http.StatusNotFound, "", `{"error":{"code":"not_found"`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := send(handler, tt.method, tt.path, noContentType, "")
			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if got := rec.Header().Get("Cache-Control"); got != tt.wantCacheControl {
				t.Errorf("Cache-Control = %q, want %q", got, tt.wantCacheControl)
			}
			if body := rec.Body.String(); !strings.HasPrefix(body, tt.wantBodyPrefix) {
				t.Errorf("body = %q, want prefix %q", body, tt.wantBodyPrefix)
			}
		})
	}
	if got := send(handler, http.MethodPost, "/", noContentType, "").Header().Get("Allow"); got != "GET, HEAD" {
		t.Errorf("Allow = %q, want %q", got, "GET, HEAD")
	}
}

func send(h http.Handler, method, path, contentType, body string) *httptest.ResponseRecorder {
	if method == "" {
		method = http.MethodPost
	}
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	switch contentType {
	case noContentType:
	case "":
		req.Header.Set("Content-Type", "application/json")
	default:
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// padTo pads a JSON document with trailing spaces to exactly n bytes.
func padTo(body string, n int) string {
	return body + strings.Repeat(" ", n-len(body))
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
