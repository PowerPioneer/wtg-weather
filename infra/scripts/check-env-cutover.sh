#!/usr/bin/env bash
# Check a prepared cutover env file without printing any value.
#
#   ./infra/scripts/check-env-cutover.sh [.env.cutover]
#
# Prints variable NAMES and pass/fail only — never a value, never a length of a
# secret beyond the bcrypt hash's (which is fixed at 60 and is the check). Safe
# to paste the output anywhere. See infra/CUTOVER-ENV.md for what each one is.
set -uo pipefail

F="${1:-.env.cutover}"
[ -f "$F" ] || { echo "❌ $F not found (run from /opt/wtg-weather)"; exit 1; }

fails=0
ok()   { echo "✅ $1"; }
bad()  { echo "❌ $1"; fails=$((fails + 1)); }
warn() { echo "⚠️  $1"; }

# Last assignment wins in compose, so read the last one; count duplicates.
count() { grep -cE "^[[:space:]]*$1=" "$F"; }
val()   { grep -E "^[[:space:]]*$1=" "$F" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

exact() {  # name expected
  local n; n=$(count "$1")
  if [ "$n" -eq 0 ]; then bad "$1 missing"
  elif [ "$(val "$1")" = "$2" ]; then
    if [ "$n" -gt 1 ]; then warn "$1 set $n times (last one is right; remove the others)"; else ok "$1"; fi
  else bad "$1 is not the expected value (see CUTOVER-ENV.md)"; fi
}
secret() {  # name prefix-or-empty description
  local n v; n=$(count "$1"); v=$(val "$1")
  if [ "$n" -eq 0 ] || [ -z "$v" ]; then bad "$1 missing or empty"; return; fi
  [ "$n" -gt 1 ] && warn "$1 set $n times"
  if [ -n "$2" ] && [[ "$v" != "$2"* ]]; then bad "$1 does not look like $3"
  else ok "$1 present"; fi
}

echo "== Paddle (live)"
exact  PADDLE_SANDBOX false
exact  NEXT_PUBLIC_PADDLE_ENV production
secret NEXT_PUBLIC_PADDLE_CLIENT_TOKEN live_ "a live client-side token (live_…)"
secret PADDLE_API_KEY "" ""
case "$(val PADDLE_API_KEY)" in *sdbx*) bad "PADDLE_API_KEY looks like a SANDBOX key";; esac
secret PADDLE_WEBHOOK_SECRET "" ""
for p in PADDLE_PRICE_CONSUMER_PREMIUM PADDLE_PRICE_AGENCY_STARTER PADDLE_PRICE_AGENCY_PRO; do
  secret "$p" pri_ "a price id (pri_…)"
done
if [ "$(count PADDLE_CHECKOUT_BASE_URL)" -gt 0 ]; then bad "PADDLE_CHECKOUT_BASE_URL still present (Paddle Classic — delete it)"; else ok "no PADDLE_CHECKOUT_BASE_URL"; fi

# Same live price ids as the current .env would mean sandbox ids were kept.
if [ -f .env ]; then
  for p in PADDLE_PRICE_CONSUMER_PREMIUM PADDLE_API_KEY NEXT_PUBLIC_PADDLE_CLIENT_TOKEN PADDLE_WEBHOOK_SECRET; do
    old=$(grep -E "^[[:space:]]*$p=" .env | tail -1 | cut -d= -f2-)
    new=$(grep -E "^[[:space:]]*$p=" "$F" | tail -1 | cut -d= -f2-)
    [ -n "$old" ] && [ "$old" = "$new" ] && bad "$p unchanged from the current (sandbox) .env"
  done
fi

echo "== Signing secrets"
# The API refuses to boot in prod unless each is at least 32 characters and not
# the dev default (`api/src/wtg_api/config.py`). Pass/fail only, no length.
for s in SESSION_SECRET TILE_SIGNING_SECRET PADDLE_WEBHOOK_SECRET; do
  v=$(val "$s")
  if [ -z "$v" ]; then bad "$s missing or empty"
  elif [[ "$v" == dev-*-change-me ]]; then bad "$s is the dev default"
  elif [ "${#v}" -lt 32 ]; then bad "$s is shorter than 32 characters"
  else ok "$s strong enough"; fi
done

echo "== Origins"
A=https://wheretogoforgreatweather.com
exact PUBLIC_WEB_ORIGIN "$A"
exact GOOGLE_REDIRECT_URI "$A/api/auth/google/callback"
exact NEXT_PUBLIC_SITE_URL "$A"
exact NEXT_PUBLIC_API_URL "$A/api"
exact NEXT_PUBLIC_APP_ENV prod
exact NEXT_PUBLIC_PLAUSIBLE_DOMAIN wheretogoforgreatweather.com

echo "== Must not have changed"
case "$(val NEXT_PUBLIC_POSTHOG_HOST)" in ""|*eu.i.posthog.com*) ok "NEXT_PUBLIC_POSTHOG_HOST (unset or EU)";; *) bad "NEXT_PUBLIC_POSTHOG_HOST is not the EU host";; esac
exact EMAIL_PROVIDER scaleway
secret NEXT_PUBLIC_POSTHOG_KEY phc_ "a PostHog project key (phc_…)"

echo "== Compose"
if docker compose --env-file "$F" config --quiet 2>/tmp/cutover-compose.err; then ok "compose accepts the file"
else bad "compose rejects the file:"; sed 's/=.*/=<redacted>/' /tmp/cutover-compose.err; fi
if grep -qi "variable is not set" /tmp/cutover-compose.err; then
  bad "compose warns about unset variables — usually a \$ that was not doubled"
  grep -io '"[A-Za-z0-9_]*" variable is not set' /tmp/cutover-compose.err | sort -u | sed 's/^/     /'
fi
rm -f /tmp/cutover-compose.err
# `compose config` re-escapes each `$` as `$$` in its output (so the output is
# itself valid compose), so a correctly doubled hash renders as 63 characters.
# Undo that before measuring: what Caddy receives is the 60-character hash.
len=$(docker compose --env-file "$F" config --format json 2>/dev/null \
  | python3 -c 'import json,sys; print(len((json.load(sys.stdin)["services"]["caddy"]["environment"].get("CADDY_BASICAUTH_HASH") or "").replace("$$", "$")))' 2>/dev/null)
if [ "$len" = "60" ]; then ok "CADDY_BASICAUTH_HASH arrives intact (60)"; else bad "CADDY_BASICAUTH_HASH arrives as ${len:-?} characters, not 60 — double every \$"; fi

echo
if [ "$fails" -eq 0 ]; then echo "All checks passed."; else echo "$fails check(s) failed."; exit 1; fi
