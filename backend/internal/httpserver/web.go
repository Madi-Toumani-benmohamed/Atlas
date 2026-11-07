package httpserver

import (
	"net/http"
	"os"
	"path"
	"strings"
	"syscall"
)

// staticFiles serves regular build files only. Root confines the actual open,
// including a symlink replacement between validation and opening the file.
func staticFiles(dir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		clean := path.Clean(r.URL.Path)
		name := strings.TrimPrefix(clean, "/")
		if clean == "/" {
			name = "index.html"
		}
		root, err := os.OpenRoot(dir)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer root.Close()
		// A build has no reason to contain hidden paths or symlinks. Reject
		// either, including an otherwise in-root link to a hidden file.
		parts := strings.Split(name, "/")
		for i, part := range parts {
			if strings.HasPrefix(part, ".") {
				http.NotFound(w, r)
				return
			}
			info, err := root.Lstat(strings.Join(parts[:i+1], "/"))
			if err != nil || info.Mode()&os.ModeSymlink != 0 || (i == len(parts)-1 && !info.Mode().IsRegular()) {
				http.NotFound(w, r)
				return
			}
		}
		// Nonblocking open also avoids waiting on a FIFO substituted after
		// Lstat. The descriptor is checked again before any content is read.
		file, err := root.OpenFile(name, os.O_RDONLY|syscall.O_NONBLOCK, 0)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil || !info.Mode().IsRegular() {
			http.NotFound(w, r)
			return
		}
		if strings.HasPrefix(clean, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		http.ServeContent(w, r, info.Name(), info.ModTime(), file)
	})
}
