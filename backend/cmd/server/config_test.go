package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// env is a fake environment.
type env map[string]string

func (e env) get(key string) string { return e[key] }

func TestLoadConfig(t *testing.T) {
	staticDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		env  env
		want config
	}{
		{"defaults", env{}, config{port: 8080, logFormat: "json"}},
		{"overrides", env{"PORT": "9090", "STATIC_DIR": staticDir, "LOG_FORMAT": "text"},
			config{port: 9090, staticDir: staticDir, logFormat: "text"}},
		{"port zero picks a free port", env{"PORT": "0"}, config{port: 0, logFormat: "json"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := loadConfig(tt.env.get)
			if err != nil {
				t.Fatalf("loadConfig() error = %v", err)
			}
			if got != tt.want {
				t.Errorf("loadConfig() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestLoadConfigErrors(t *testing.T) {
	emptyDir := t.TempDir()
	file := filepath.Join(t.TempDir(), "index.html")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		env  env
		want []string
	}{
		{"port is not a number", env{"PORT": "http"}, []string{`PORT must be an integer from 0 to 65535, got "http"`}},
		{"port is negative", env{"PORT": "-1"}, []string{`got "-1"`}},
		{"port is too large", env{"PORT": "65536"}, []string{`got "65536"`}},
		{"static dir is missing", env{"STATIC_DIR": "/does/not/exist"}, []string{`STATIC_DIR must be a directory with an index.html, got "/does/not/exist"`}},
		{"static dir is a file", env{"STATIC_DIR": file}, []string{"STATIC_DIR must be a directory with an index.html"}},
		{"static dir has no index.html", env{"STATIC_DIR": emptyDir}, []string{"STATIC_DIR must be a directory with an index.html"}},
		{"unknown log format", env{"LOG_FORMAT": "xml"}, []string{`LOG_FORMAT must be json or text, got "xml"`}},
		{"every problem is reported", env{"PORT": "x", "LOG_FORMAT": "xml"}, []string{"PORT", "LOG_FORMAT"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := loadConfig(tt.env.get)
			if err == nil {
				t.Fatal("loadConfig() succeeded, want an error")
			}
			for _, want := range tt.want {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q does not mention %q", err, want)
				}
			}
		})
	}
}

func TestConfigAddr(t *testing.T) {
	if got := (config{port: 8080}).addr(); got != ":8080" {
		t.Errorf("addr() = %q, want %q", got, ":8080")
	}
}
