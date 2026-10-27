// Package server exposes the calculator over HTTP: routing, strict JSON
// decoding, error mapping, middleware, and serving the built frontend.
package server

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/aozmekik/fullstack-calculator/backend/internal/calculator"
)

// Options configures New.
type Options struct {
	// Logger receives access logs and server-side errors. Nil discards them.
	Logger *slog.Logger
	// StaticDir, if set, is a directory of built frontend assets served at "/".
	StaticDir string
}

type server struct {
	logger *slog.Logger
}

// New returns the HTTP handler for the whole service.
func New(opts Options) http.Handler {
	logger := opts.Logger
	if logger == nil {
		logger = slog.New(slog.DiscardHandler)
	}
	s := &server{logger: logger}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("/healthz", methodNotAllowed(http.MethodGet, http.MethodHead))
	for _, op := range calculator.Operations() {
		path := "/api/v1/" + string(op)
		mux.HandleFunc("POST "+path, s.handleCalculate(op))
		// Without this pattern, "/api/" would answer other methods with a 404.
		mux.HandleFunc(path, methodNotAllowed(http.MethodPost))
	}
	mux.HandleFunc("/api/", notFound)
	// "/" must stay method-less: "GET /" would conflict with the method-less
	// patterns above, and ServeMux panics on conflicting patterns.
	if opts.StaticDir != "" {
		mux.Handle("/", staticFiles(opts.StaticDir))
	} else {
		mux.HandleFunc("/", notFound)
	}

	return chain(mux, requestID, logRequests(logger), recoverPanics(logger), securityHeaders)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func notFound(w http.ResponseWriter, r *http.Request) {
	writeAPIError(w, newAPIError(http.StatusNotFound, codeNotFound, "no route for %s %s", r.Method, r.URL.Path))
}

func methodNotAllowed(allowed ...string) http.HandlerFunc {
	allow := strings.Join(allowed, ", ")
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", allow)
		writeAPIError(w, newAPIError(http.StatusMethodNotAllowed, codeMethodNotAllowed,
			"method %s is not allowed; use %s", r.Method, allow))
	}
}
