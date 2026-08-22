#!/usr/bin/env bash
set -uo pipefail

PROJECT="rarelix-preview"
EXPECTED_ARCHIVE_SHA256="f4e441d2e1707450331e84d88b584dfea3debd36912d312b425368430cacac12"
RESULT_FILE=".rarelix/LIVE_PREVIEW_RESULT.txt"
STAGE="started"
URL=""
PROJECT_HTTP=""
PROJECT_CREATE_HTTP=""
WRANGLER_EXIT=""
SMOKE_HTTP=""

publish_result() {
  rc=$?
  trap - EXIT
  if [[ "$rc" -eq 0 ]]; then
    status="success"
  else
    status="failure"
  fi
  mkdir -p .rarelix
  {
    echo "status=$status"
    echo "stage=$STAGE"
    echo "source_sha=${GITHUB_SHA:-unknown}"
    echo "archive_sha256=$EXPECTED_ARCHIVE_SHA256"
    echo "public_files=56"
    echo "url=$URL"
    echo "project_http=$PROJECT_HTTP"
    echo "project_create_http=$PROJECT_CREATE_HTTP"
    echo "wrangler_exit=$WRANGLER_EXIT"
    echo "smoke_http=$SMOKE_HTTP"
  } > "$RESULT_FILE"
  exit "$rc"
}
trap publish_result EXIT

set -e

test -n "${CLOUDFLARE_API_TOKEN:-}" || { echo "CLOUDFLARE_API_TOKEN is missing" >&2; exit 20; }
test -n "${CLOUDFLARE_ACCOUNT_ID:-}" || { echo "CLOUDFLARE_ACCOUNT_ID is missing" >&2; exit 21; }
STAGE="credentials_verified"

archive="$RUNNER_TEMP/rarelix-v39-pages.tar.xz"
dist="$RUNNER_TEMP/rarelix-dist"
cat .rarelix/payload/part*.b64 | base64 --decode > "$archive"
echo "$EXPECTED_ARCHIVE_SHA256  $archive" | sha256sum -c -
mkdir -p "$dist"
tar -xJf "$archive" -C "$dist"
rm -f \
  "$dist/assets/icon-192-opt.png" \
  "$dist/assets/icon-192-q.png" \
  "$dist/assets/icon-512-opt.png" \
  "$dist/assets/icon-512-q.png"
test "$(find "$dist" -type f | wc -l | tr -d ' ')" -eq 56
if grep -RInE 'icon-(192|512)-(opt|q)\.png' "$dist"; then
  echo "Removed icon variant is still referenced." >&2
  exit 22
fi
STAGE="payload_verified"

grep -Fqi 'X-Robots-Tag: noindex, nofollow, noarchive' "$dist/_headers"
grep -Eq '^Disallow:[[:space:]]*/' "$dist/robots.txt"
grep -Fq 'RARELIX' "$dist/index.html"
if grep -RniE --binary-files=without-match 'buildtools|hosy|findza|findblaze' "$dist"; then
  echo "Reserved/internal naming leaked into public preview." >&2
  exit 23
fi
STAGE="safety_verified"

project_json="$RUNNER_TEMP/pages-project.json"
PROJECT_HTTP="$(curl --silent --show-error \
  --output "$project_json" \
  --write-out '%{http_code}' \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT")"

if [[ "$PROJECT_HTTP" == "404" ]]; then
  create_json="$RUNNER_TEMP/pages-project-create.json"
  PROJECT_CREATE_HTTP="$(curl --silent --show-error \
    --output "$create_json" \
    --write-out '%{http_code}' \
    --request POST \
    --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    --header 'Content-Type: application/json' \
    --data '{"name":"rarelix-preview","production_branch":"release"}' \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects")"
  if [[ "$PROJECT_CREATE_HTTP" != "200" && "$PROJECT_CREATE_HTTP" != "201" ]]; then
    cat "$create_json" >&2
    exit 24
  fi
elif [[ "$PROJECT_HTTP" != "200" ]]; then
  cat "$project_json" >&2
  exit 25
fi
STAGE="pages_project_ready"

set +e
./node_modules/.bin/wrangler pages deploy "$dist" \
  --project-name="$PROJECT" \
  --branch=preview \
  2>&1 | tee "$RUNNER_TEMP/pages-deploy.log"
WRANGLER_EXIT="${PIPESTATUS[0]}"
set -e
if [[ "$WRANGLER_EXIT" != "0" ]]; then
  exit "$WRANGLER_EXIT"
fi
STAGE="pages_deployed"

mapfile -t CANDIDATE_URLS < <(grep -Eo 'https://[A-Za-z0-9.-]+\.pages\.dev' "$RUNNER_TEMP/pages-deploy.log" | awk '!seen[$0]++')
if [[ "${#CANDIDATE_URLS[@]}" -eq 0 ]]; then
  echo "Wrangler did not return a Pages URL." >&2
  exit 26
fi

SMOKE_OK=0
for candidate in "${CANDIDATE_URLS[@]}"; do
  echo "Smoke-testing Pages candidate: $candidate"
  headers="$RUNNER_TEMP/live-headers.txt"
  body="$RUNNER_TEMP/live-home.html"
  rm -f "$headers" "$body"
  set +e
  SMOKE_HTTP="$(curl --silent --show-error --location \
    --retry 10 --retry-all-errors --retry-delay 2 \
    --connect-timeout 10 --max-time 30 \
    --dump-header "$headers" \
    --output "$body" \
    --write-out '%{http_code}' \
    "$candidate/")"
  curl_rc=$?
  set -e
  if [[ "$curl_rc" -ne 0 || "$SMOKE_HTTP" != "200" ]]; then
    continue
  fi
  if ! grep -Fq 'RARELIX' "$body"; then
    continue
  fi
  if ! grep -Eqi '^x-robots-tag:.*noindex' "$headers"; then
    continue
  fi
  URL="$candidate"
  SMOKE_OK=1
  break
done

if [[ "$SMOKE_OK" -ne 1 ]]; then
  echo "No returned Cloudflare Pages URL passed the live brand + noindex smoke test." >&2
  exit 27
fi
STAGE="live_smoke_verified"

echo "RARELIX live preview: $URL"
