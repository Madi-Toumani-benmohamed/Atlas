#!/bin/sh
set -eu
mkdir -p /out/licenses/go
cp /usr/local/go/LICENSE /out/licenses/Go-LICENSE
printf '%s\n' 'Atlas Portfolio — backend notices' '' 'Go standard library: /licenses/backend/Go-LICENSE' > /out/licenses/NOTICE.txt
for module_dir in $(go list -deps -f '{{if .Module}}{{.Module.Dir}}{{end}}' ./cmd/... | sort -u); do
  case "$module_dir" in /go/pkg/mod/*) ;; *) continue;; esac
  relative=${module_dir#/go/pkg/mod/}
  found=false
  for notice in LICENSE LICENSE.txt LICENSE.md LICENCE COPYING NOTICE COPYRIGHT PATENTS; do
    if [ -f "$module_dir/$notice" ]; then
      mkdir -p "/out/licenses/go/$relative"
      cp "$module_dir/$notice" "/out/licenses/go/$relative/$notice"
      printf '%s\n' "$relative: /licenses/backend/go/$relative/$notice" >> /out/licenses/NOTICE.txt
      found=true
    fi
  done
  [ "$found" = true ] || { echo "Missing module license: $relative" >&2; exit 1; }
done
