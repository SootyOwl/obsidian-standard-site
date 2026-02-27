#!/usr/bin/env bash
set -euo pipefail

REPO_BASE="https://raw.githubusercontent.com/SootyOwl/obsidian-standard-site/main/viewer"

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

# Patch index.html
# Escape sed special characters in replacement strings
HANDLE_ESC="${HANDLE//\\/\\\\}"
HANDLE_ESC="${HANDLE_ESC//&/\\&}"
HANDLE_ESC="${HANDLE_ESC//\//\\/}"
HANDLE_ESC="${HANDLE_ESC//\"/\\\"}"
RKEY_ESC="${RKEY//\\/\\\\}"
RKEY_ESC="${RKEY_ESC//&/\\&}"
RKEY_ESC="${RKEY_ESC//\//\\/}"
RKEY_ESC="${RKEY_ESC//\"/\\\"}"
sed "s/const HANDLE = \".*\";/const HANDLE = \"${HANDLE_ESC}\";/" index.html > index.html.tmp && mv index.html.tmp index.html
sed "s/const PUBLICATION_RKEY = \".*\";/const PUBLICATION_RKEY = \"${RKEY_ESC}\";/" index.html > index.html.tmp && mv index.html.tmp index.html
info "Updated index.html"

# Patch .well-known/site.standard.publication
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
echo "    .well-known/site.standard.publication"
echo ""
