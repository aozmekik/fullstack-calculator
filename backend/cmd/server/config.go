package main

import (
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
)

// config is the service configuration, read from the environment.
type config struct {
	port      int    // TCP port to listen on; 0 picks a free one
	staticDir string // directory of built frontend assets to serve, if any
	logFormat string // "json" for log pipelines, "text" for humans
}

// loadConfig reads PORT, STATIC_DIR and LOG_FORMAT. It reports every invalid
// value at once, so a misconfigured deploy fails fast with the full story.
func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{port: 8080, staticDir: getenv("STATIC_DIR"), logFormat: "json"}
	var errs []error

	if v := getenv("PORT"); v != "" {
		port, err := strconv.Atoi(v)
		if err != nil || port < 0 || port > 65535 {
			errs = append(errs, fmt.Errorf("PORT must be an integer from 0 to 65535, got %q", v))
		}
		cfg.port = port
	}
	if cfg.staticDir != "" {
		if info, err := os.Stat(cfg.staticDir); err != nil || !info.IsDir() {
			errs = append(errs, fmt.Errorf("STATIC_DIR must be a directory, got %q", cfg.staticDir))
		}
	}
	if v := getenv("LOG_FORMAT"); v != "" {
		if v != "json" && v != "text" {
			errs = append(errs, fmt.Errorf("LOG_FORMAT must be json or text, got %q", v))
		}
		cfg.logFormat = v
	}

	if err := errors.Join(errs...); err != nil {
		return config{}, fmt.Errorf("invalid configuration: %w", err)
	}
	return cfg, nil
}

func (c config) addr() string {
	return net.JoinHostPort("", strconv.Itoa(c.port))
}
