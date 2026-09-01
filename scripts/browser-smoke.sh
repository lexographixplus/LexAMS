#!/usr/bin/env bash
set -euo pipefail

LEXAMS_PREVIEW_HOST="deploy-preview-999--lexams.netlify.app"
PORT="4173"
BASE_URL="http://${LEXAMS_PREVIEW_HOST}:${PORT}"

BROWSER_BIN="${BROWSER_BIN:-}"
if [[ -z "$BROWSER_BIN" ]]; then
  BROWSER_BIN="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi
if [[ -z "$BROWSER_BIN" ]]; then
  echo "A Chromium/Chrome browser is required for the browser smoke test." >&2
  exit 1
fi

if ! grep -q "${LEXAMS_PREVIEW_HOST}" /etc/hosts; then
  echo "127.0.0.1 ${LEXAMS_PREVIEW_HOST}" | sudo tee -a /etc/hosts >/dev/null
fi

# Vite normally rejects non-local Host headers. Allow only this synthetic
# Netlify-style hostname for the test process so production host policy is not
# widened in vite.config.js.
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="$LEXAMS_PREVIEW_HOST" \
  npm run preview -- --host 0.0.0.0 --port "$PORT" >/tmp/lexams-browser-preview.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null

render() {
  local path="$1"
  local output="$2"
  "$BROWSER_BIN" \
    --headless \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --no-proxy-server \
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

# Deploy-preview host activates the safe synthetic owner workspace. These checks
# render the real React routes in Chromium rather than testing source strings.
assert_app_page "/app" "dashboard"
assert_app_page "/app/activities" "activities"
assert_app_page "/app/activities/-8101" "activity-detail"
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
# The browser gate verifies that an Owner/Admin preview workspace can render the
# billing surface itself without coupling the smoke test to transient checkout copy.
assert_page "/app/billing" "Billing & plan"

echo "Headless browser critical-flow smoke tests passed."
