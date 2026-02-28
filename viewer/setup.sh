#!/usr/bin/env bash
set -euo pipefail

REPO_BASE="https://raw.githubusercontent.com/SootyOwl/obsidian-standard-site/refs/heads/main/viewer"

# ── Colors ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$1"; }
error() { printf "${RED}✗${NC} %s\n" "$1" >&2; }
die()   { error "$1"; exit 1; }

# ── Dependency checks ──────────────────────────────────────────
command -v curl &>/dev/null || die "curl is required but not installed."

JSON_CMD=""
if command -v jq &>/dev/null; then
  JSON_CMD="jq"
elif command -v python3 &>/dev/null; then
  JSON_CMD="python3"
else
  die "Either jq or python3 is required for JSON parsing."
fi

# ── JSON helpers (specific per API call) ───────────────────────

json_did() {
  if [ "$JSON_CMD" = "jq" ]; then
    jq -r '.did'
  else
    python3 -c "import sys,json; print(json.load(sys.stdin)['did'])"
  fi
}

json_pds() {
  if [ "$JSON_CMD" = "jq" ]; then
    jq -r '.service[] | select(.id == "#atproto_pds" or .type == "AtprotoPersonalDataServer") | .serviceEndpoint'
  else
    python3 -c "
import sys, json
doc = json.load(sys.stdin)
for s in doc.get('service', []):
    if s.get('id') == '#atproto_pds' or s.get('type') == 'AtprotoPersonalDataServer':
        print(s['serviceEndpoint'])
        break
"
  fi
}

json_publications() {
  # Output: one line per publication as "rkey<TAB>name"
  if [ "$JSON_CMD" = "jq" ]; then
    jq -r '(.records // [])[] | (.uri | split("/") | last) + "\t" + (.value.name // "(untitled)")'
  else
    python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('records', []):
    rkey = r['uri'].split('/')[-1]
    name = r.get('value', {}).get('name') or '(untitled)'
    print(f'{rkey}\t{name}')
"
  fi
}

json_cursor() {
  if [ "$JSON_CMD" = "jq" ]; then
    jq -r '.cursor // empty'
  else
    python3 -c "
import sys, json
data = json.load(sys.stdin)
c = data.get('cursor', '')
if c: print(c)
"
  fi
}

json_pub_detail() {
  # Output: name<TAB>description<TAB>url
  if [ "$JSON_CMD" = "jq" ]; then
    jq -r '(.value.name // "") + "\t" + (.value.description // "") + "\t" + (.value.url // "")'
  else
    python3 -c "
import sys, json
v = json.load(sys.stdin).get('value', {})
name = v.get('name', '')
desc = v.get('description', '')
url = v.get('url', '')
print(f'{name}\t{desc}\t{url}')
"
  fi
}

derive_base_path() {
  local url="$1"
  if [ -z "$url" ]; then
    echo ""
    return
  fi
  if command -v python3 &>/dev/null; then
    python3 - "$url" <<'PY'
import sys
from urllib.parse import urlparse

url = sys.argv[1] if len(sys.argv) > 1 else ""
p = urlparse(url).path.rstrip('/')
print('' if p == '/' else p)
PY
  else
    # Bash fallback
    local no_proto="${url#*://}"
    local path_part="${no_proto#*/}"
    if [ "$path_part" = "$no_proto" ]; then
      echo ""
    else
      local path="/${path_part%/}"
      [ "$path" = "/" ] && path=""
      echo "$path"
    fi
  fi
}

urlencode() {
  if [ "$JSON_CMD" = "python3" ] || command -v python3 &>/dev/null; then
    python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
  else
    printf '%s' "$1" | jq -sRr @uri
  fi
}

# ── Download viewer files ──────────────────────────────────────
printf "Downloading viewer files...\n"

curl -fsSL "${REPO_BASE}/index.html" -o index.html \
  || die "Failed to download index.html"
info "Downloaded index.html"

mkdir -p .well-known
curl -fsSL "${REPO_BASE}/.well-known/site.standard.publication" -o .well-known/site.standard.publication \
  || die "Failed to download .well-known/site.standard.publication"
info "Downloaded .well-known/site.standard.publication"

curl -fsSL "${REPO_BASE}/404.html" -o 404.html \
  || die "Failed to download 404.html"
info "Downloaded 404.html"

mkdir -p functions/_lib
curl -fsSL "${REPO_BASE}/functions/[[path]].js" -o "functions/[[path]].js" \
  || warn "Could not download Cloudflare Pages Function (optional)"
curl -fsSL "${REPO_BASE}/functions/_lib/helpers.js" -o "functions/_lib/helpers.js" \
  || warn "Could not download function helpers (optional)"
if [ -f "functions/[[path]].js" ]; then
  info "Downloaded Cloudflare Pages Function (optional — for Cloudflare Pages deployment)"
fi

# ── Interactive setup ──────────────────────────────────────────
printf "Enter your Bluesky handle: "
read -r HANDLE < /dev/tty
[ -z "$HANDLE" ] && die "Handle is required."

# Resolve handle → DID
printf "Resolving handle... "
DID=$(curl -fsSL "https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=$(urlencode "$HANDLE")" | json_did)
[ -z "$DID" ] || [ "$DID" = "null" ] && die "Could not resolve handle \"${HANDLE}\""
printf "%s\n" "$DID"

# Resolve DID → PDS
printf "Finding PDS... "
if [[ "$DID" == did:plc:* ]]; then
  DID_DOC=$(curl -fsSL "https://plc.directory/${DID}")
elif [[ "$DID" == did:web:* ]]; then
  WEB_HOST="${DID#did:web:}"
  WEB_HOST="${WEB_HOST//:///}"
  DID_DOC=$(curl -fsSL "https://${WEB_HOST}/.well-known/did.json")
else
  die "Unsupported DID method: ${DID}"
fi
PDS_URL=$(echo "$DID_DOC" | json_pds)
[ -z "$PDS_URL" ] || [ "$PDS_URL" = "null" ] && die "No PDS service found in DID document"
printf "%s\n" "$PDS_URL"
echo ""

# List publications
PUBLICATIONS=""
CURSOR=""
while true; do
  URL="${PDS_URL}/xrpc/com.atproto.repo.listRecords?repo=$(urlencode "$DID")&collection=site.standard.publication&limit=100"
  [ -n "$CURSOR" ] && URL="${URL}&cursor=$(urlencode "$CURSOR")"
  RESPONSE=$(curl -fsSL "$URL") || die "Failed to list publications from PDS"
  PAGE=$(echo "$RESPONSE" | json_publications)
  [ -n "$PAGE" ] && PUBLICATIONS="${PUBLICATIONS}${PAGE}"$'\n'
  CURSOR=$(echo "$RESPONSE" | json_cursor)
  [ -z "$CURSOR" ] && break
done

# Trim trailing newline
PUBLICATIONS=$(echo "$PUBLICATIONS" | sed '/^$/d')

if [ -z "$PUBLICATIONS" ]; then
  die "No publications found. Publish from the Obsidian plugin first, then re-run this script."
fi

PUB_COUNT=$(echo "$PUBLICATIONS" | wc -l | tr -d ' ')

# Select publication
if [ "$PUB_COUNT" -eq 1 ]; then
  RKEY=$(echo "$PUBLICATIONS" | head -1 | cut -f1)
  PUB_NAME=$(echo "$PUBLICATIONS" | head -1 | cut -f2)
  printf "Found publication: %s (rkey: %s)\n" "$PUB_NAME" "$RKEY"
else
  echo "Publications:"
  I=1
  while IFS=$'\t' read -r rkey name; do
    printf "  %d. %s (rkey: %s)\n" "$I" "$name" "$rkey"
    I=$((I + 1))
  done <<< "$PUBLICATIONS"
  echo ""
  printf "Select publication [1]: "
  read -r CHOICE < /dev/tty
  CHOICE="${CHOICE:-1}"
  RKEY=$(echo "$PUBLICATIONS" | sed -n "${CHOICE}p" | cut -f1)
  PUB_NAME=$(echo "$PUBLICATIONS" | sed -n "${CHOICE}p" | cut -f2)
  [ -z "$RKEY" ] && die "Invalid selection."
fi

# Fetch full publication record for metadata
printf "Fetching publication details... "
PUB_DETAIL=$(curl -fsSL "${PDS_URL}/xrpc/com.atproto.repo.getRecord?repo=$(urlencode "$DID")&collection=site.standard.publication&rkey=$(urlencode "$RKEY")" | json_pub_detail)
PUB_NAME=$(echo "$PUB_DETAIL" | cut -f1)
PUB_DESC=$(echo "$PUB_DETAIL" | cut -f2)
PUB_URL=$(echo "$PUB_DETAIL" | cut -f3)
BASE_PATH=$(derive_base_path "$PUB_URL")
info "Name: ${PUB_NAME:-"(none)"}"
[ -n "$PUB_DESC" ] && info "Description: ${PUB_DESC}"
[ -n "$PUB_URL" ] && info "URL: ${PUB_URL}"
[ -n "$BASE_PATH" ] && info "Base path: ${BASE_PATH}"

# Escape values for sed
HANDLE_ESC=$(printf '%s' "$HANDLE" | sed 's/[&/\\]/\\&/g')
RKEY_ESC=$(printf '%s' "$RKEY" | sed 's/[&/\\]/\\&/g')
BASE_PATH_ESC=$(printf '%s' "$BASE_PATH" | sed 's/[&/\\]/\\&/g')
PUB_NAME_ESC=$(printf '%s' "$PUB_NAME" | sed 's/[&/\\]/\\&/g')
PUB_DESC_ESC=$(printf '%s' "$PUB_DESC" | sed 's/[&/\\]/\\&/g')
PUB_URL_ESC=$(printf '%s' "$PUB_URL" | sed 's/[&/\\]/\\&/g')

# Patch index.html
sed "s|const HANDLE = \".*\";|const HANDLE = \"${HANDLE_ESC}\";|" index.html > index.html.tmp && mv index.html.tmp index.html
sed "s|const PUBLICATION_RKEY = \".*\";|const PUBLICATION_RKEY = \"${RKEY_ESC}\";|" index.html > index.html.tmp && mv index.html.tmp index.html
sed "s|const BASE_PATH = \".*\";|const BASE_PATH = \"${BASE_PATH_ESC}\";|" index.html > index.html.tmp && mv index.html.tmp index.html
info "Updated index.html (config)"

# Patch OG meta tags
sed "s|<title>[^<]*</title>|<title>${PUB_NAME_ESC}</title>|" index.html > index.html.tmp && mv index.html.tmp index.html
sed "s|og:title\" content=\"[^\"]*\"|og:title\" content=\"${PUB_NAME_ESC}\"|" index.html > index.html.tmp && mv index.html.tmp index.html
sed "s|og:description\" content=\"[^\"]*\"|og:description\" content=\"${PUB_DESC_ESC}\"|" index.html > index.html.tmp && mv index.html.tmp index.html
sed "s|og:url\" content=\"[^\"]*\"|og:url\" content=\"${PUB_URL_ESC}\"|" index.html > index.html.tmp && mv index.html.tmp index.html
info "Updated index.html (OG tags)"

# Patch 404.html
sed "s|const BASE_PATH = \".*\";|const BASE_PATH = \"${BASE_PATH_ESC}\";|" 404.html > 404.html.tmp && mv 404.html.tmp 404.html
info "Updated 404.html"

# Patch .well-known
printf "at://%s/site.standard.publication/%s\n" "$DID" "$RKEY" > .well-known/site.standard.publication
info "Updated .well-known/site.standard.publication"

echo ""
info "Setup complete!"
echo ""
echo "  Deploy this directory to any static host:"
echo "  GitHub Pages, Cloudflare Pages, Netlify, etc."
echo ""
echo "  Files:"
echo "    index.html"
echo "    404.html"
echo "    .well-known/site.standard.publication"
if [ -f "functions/[[path]].js" ]; then
  echo "    functions/          (Cloudflare Pages only — enables per-post social cards)"
fi
echo ""
