package server

import (
	"net/http"
	"os"
	"strings"
)

// staticFiles serves the built frontend from dir. Vite fingerprints every file
// under /assets/, so those are cached forever; anything else, notably
// index.html, is revalidated so that a new deploy shows up on the next load.
func staticFiles(dir string) http.Handler {
	files := http.FileServerFS(os.DirFS(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path != "/" && strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r) // no directory listings
			return
		}
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		files.ServeHTTP(w, r)
	})
}
