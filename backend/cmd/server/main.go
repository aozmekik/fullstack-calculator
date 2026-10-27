// Command server runs the calculator HTTP service.
//
// It is configured through the environment:
//
//	PORT        TCP port to listen on (default 8080)
//	STATIC_DIR  directory of built frontend assets to serve at / (optional)
//	LOG_FORMAT  json (default) or text
package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/aozmekik/fullstack-calculator/backend/internal/server"
)

// shutdownTimeout bounds how long in-flight requests get to finish on exit.
const shutdownTimeout = 10 * time.Second

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	err := run(ctx, os.Getenv, os.Stdout)
	stop()
	if err != nil {
		fmt.Fprintln(os.Stderr, "server:", err)
		os.Exit(1)
	}
}

// run starts the service and blocks until ctx is canceled or serving fails.
func run(ctx context.Context, getenv func(string) string, stdout io.Writer) error {
	cfg, err := loadConfig(getenv)
	if err != nil {
		return err
	}
	logger := newLogger(cfg.logFormat, stdout)

	var lc net.ListenConfig
	ln, err := lc.Listen(ctx, "tcp", cfg.addr())
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	logger.Info("listening", "addr", ln.Addr().String(), "static_dir", cfg.staticDir)

	srv := newHTTPServer(server.New(server.Options{Logger: logger, StaticDir: cfg.staticDir}), logger)
	if err := serve(ctx, srv, ln); err != nil {
		return err
	}
	logger.Info("stopped")
	return nil
}

func newLogger(format string, w io.Writer) *slog.Logger {
	if format == "text" {
		return slog.New(slog.NewTextHandler(w, nil))
	}
	return slog.New(slog.NewJSONHandler(w, nil))
}

// newHTTPServer wraps handler in a server whose timeouts keep slow or stalled
// clients from holding connections open indefinitely.
func newHTTPServer(handler http.Handler, logger *slog.Logger) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelWarn),
	}
}

// serve runs srv on ln until ctx is canceled, then shuts down gracefully: it
// stops accepting connections and lets in-flight requests finish.
func serve(ctx context.Context, srv *http.Server, ln net.Listener) error {
	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()

	select {
	case err := <-errc:
		return fmt.Errorf("serve: %w", err)
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	return nil
}
