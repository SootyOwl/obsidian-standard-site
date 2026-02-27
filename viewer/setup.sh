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
    jq -r '.records[] | (.uri | split("/") | last) + "\t" + (.value.name // "(untitled)")'
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

echo ""
