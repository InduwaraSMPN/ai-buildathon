#!/bin/sh
# Writes /config.js from the environment before nginx starts, so one built
# image serves any environment. index.html loads this file before the bundle;
# the app reads window.__AXIOMA_CONFIG__ and falls back to its build-time
# VITE_* defaults for any key left empty.
set -eu

target="${AXIOMA_RUNTIME_CONFIG_PATH:-/usr/share/nginx/html/config.js}"

# The values land inside a JSON string literal, so a stray quote or backslash
# would produce a file that fails to parse and take the whole app down.
escape() {
    printf '%s' "${1:-}" | sed -e 's|\\|\\\\|g' -e 's|"|\\"|g'
}

cat >"$target" <<JS
// Generated at container start by deploy/runtime-config.sh. Do not edit.
window.__AXIOMA_CONFIG__ = {
  "apiUrl": "$(escape "${AXIOMA_API_URL:-}")",
  "portalUrl": "$(escape "${AXIOMA_PORTAL_URL:-}")",
  "siteUrl": "$(escape "${AXIOMA_SITE_URL:-}")"
};
JS

echo "runtime-config: wrote $target (apiUrl=${AXIOMA_API_URL:-<unset>})"
