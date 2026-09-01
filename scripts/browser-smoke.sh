#!/usr/bin/env bash
set -euo pipefail

LEXAMS_PREVIEW_HOST="deploy-preview-999--lexams.netlify.app"
PORT="4173"
BASE_URL="https://${LEXAMS_PREVIEW_HOST}:${PORT}"

BROWSER_BIN="${BROWSER_BIN:-}"
if [[ -z "$BROWSER_BIN" ]]; then
  BROWSER_BIN="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi
if [[ -z "$BROWSER_BIN" ]]; then
  echo "A Chromium/Chrome browser is required for the browser smoke test." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "OpenSSL is required for the browser smoke test." >&2
  exit 1
fi

if [[ ! -f dist/index.html ]]; then
  npm run build >/tmp/lexams-browser-build.log 2>&1
fi

if ! grep -q "${LEXAMS_PREVIEW_HOST}" /etc/hosts; then
  echo "127.0.0.1 ${LEXAMS_PREVIEW_HOST}" | sudo tee -a /etc/hosts >/dev/null
fi

CERT_DIR="$(mktemp -d)"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "${CERT_DIR}/key.pem" \
  -out "${CERT_DIR}/cert.pem" \
  -days 1 \
  -subj "/CN=${LEXAMS_PREVIEW_HOST}" \
  -addext "subjectAltName=DNS:${LEXAMS_PREVIEW_HOST}" \
  >/dev/null 2>&1

LEXAMS_PREVIEW_CERT="${CERT_DIR}/cert.pem" \
LEXAMS_PREVIEW_KEY="${CERT_DIR}/key.pem" \
LEXAMS_PREVIEW_PORT="$PORT" \
  node scripts/https-preview.mjs >/tmp/lexams-browser-preview.log 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  rm -rf "$CERT_DIR"
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -kfsS "https://127.0.0.1:${PORT}/" >/dev/null; then
    break
  fi
  sleep 1
done
if ! curl -kfsS "https://127.0.0.1:${PORT}/" >/dev/null; then
  cat /tmp/lexams-browser-preview.log >&2
  exit 1
fi

render() {
  local path="$1"
  local output="$2"
  "$BROWSER_BIN" \
    --headless \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --no-proxy-server \
    --ignore-certificate-errors \
    --virtual-time-budget=5000 \
    --dump-dom "${BASE_URL}${path}" >"$output" 2>/tmp/lexams-browser-errors.log
}

assert_page() {
  local path="$1"
  local marker="$2"
  local output
  output="$(mktemp)"
  render "$path" "$output"
  if ! grep -q "$marker" "$output"; then
    echo "Browser smoke failed for ${path}: marker ${marker} was not rendered." >&2
    cat "$output" >&2
    exit 1
  fi
  if grep -qi "We could not load your workspace" "$output"; then
    echo "Browser smoke failed for ${path}: workspace session error rendered." >&2
    exit 1
  fi
}

assert_app_page() {
  local path="$1"
  local suffix="$2"
  local output
  output="$(mktemp)"
  render "$path" "$output"
  # Every protected workspace route is wrapped by App.jsx with the canonical
  # `lexams-ui-${name}` marker. Checking that wrapper confirms the requested
  # route rendered, independent of page-internal styling class names.
  if ! grep -q "lexams-ui-${suffix}" "$output"; then
    echo "Browser smoke failed for ${path}: route marker ${suffix} was not rendered." >&2
    cat "$output" >&2
    exit 1
  fi
  if grep -qi "We could not load your workspace" "$output"; then
    echo "Browser smoke failed for ${path}: workspace session error rendered." >&2
    exit 1
  fi
}

# Marketing/auth surfaces remain reachable.
assert_page "/" "LexAMS"
assert_page "/login" "LexAMS"
assert_page "/contact" "LexAMS"

# The Netlify-style hostname activates the existing safe synthetic owner
# workspace. A local HTTPS server is used because Chrome correctly upgrades
# netlify.app hosts to HTTPS via HSTS.
assert_app_page "/app" "dashboard"
assert_app_page "/app/activities" "activities"
assert_app_page "/app/activities/-8101" "activity-detail"

# Selected-activity tabs can be deep-linked for deterministic release checks.
# These markers protect the shorter workspace structure introduced by the
# activity UX refactor without depending on mutable activity data values.
assert_page "/app/activities/-8101?view=participants" "Participant outcomes"
assert_page "/app/activities/-8101?view=attendance" "Attendance ledger"

assert_app_page "/app/participants" "participants"
assert_app_page "/app/reports" "reports"
assert_app_page "/app/assessments" "assessments"
assert_app_page "/app/surveys" "surveys"
assert_app_page "/app/certificates" "certificates"
assert_app_page "/app/communications" "communications"
assert_app_page "/app/team" "team"
assert_app_page "/app/settings" "settings"
assert_app_page "/app/billing" "billing"

# Billing authorization is enforced and regression-tested at the server API.
# Browser coverage intentionally verifies the billing route itself, not mutable
# plan-state copy or checkout CTA text.

echo "Headless browser critical-flow smoke tests passed."
