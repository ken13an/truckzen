#!/usr/bin/env bash
# Guarded production deploy for TruckZen.
#
# Purpose: prevent unrelated / dirty-tree `vercel --prod` deploys from stealing
# the truckzen.pro alias. See docs/deploy/TRUCKZEN_PRODUCTION_DEPLOY_RUNBOOK.md.
#
# Usage:
#   I_UNDERSTAND_PRODUCTION=YES bash scripts/deploy_prod_guarded.sh
#
# Optional override (only if you intentionally release from a non-main branch):
#   ALLOWED_PROD_BRANCH_REGEX='^(main|release/.*)$' \
#   I_UNDERSTAND_PRODUCTION=YES bash scripts/deploy_prod_guarded.sh

set -euo pipefail

# ── Configuration (single source of truth at top) ─────────────────────────────
EXPECTED_PROJECT_ID="prj_B8vyyqolkZt3O9XIRgJqTCVIW9cT"
EXPECTED_ORG_ID="team_KQcTGcvlPxpFDRLd2dGz2fdV"
PROD_DOMAIN="truckzen.pro"
ALLOWED_PROD_BRANCH_REGEX="${ALLOWED_PROD_BRANCH_REGEX:-^main$}"

# Production Lineage Rule — accepted-and-live UI/design truth that must never
# be rolled back. Every deploy source must contain each of these as an
# ancestor of HEAD, or this script refuses to deploy. See
# docs/deploy/TRUCKZEN_PRODUCTION_LINEAGE_RULE.md for rationale and the
# procedure for adding new entries when a UI/design change is accepted live.
REQUIRED_LIVE_COMMITS=(
  # design(landing): apply generated Base44-style landing page
  "a93b4f6"
  # design(login): add cool starfield background
  "6af01bd"
)

# ── Pretty output ─────────────────────────────────────────────────────────────
red()    { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

fail() {
  red "[deploy_prod_guarded] FAIL: $*"
  exit 1
}

# ── 1. Repo identity ──────────────────────────────────────────────────────────
[ -f package.json ] || fail "Not a project root: package.json not found in $(pwd)"

PKG_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "")
[ "$PKG_NAME" = "truckzen" ] || fail "package.json name is '$PKG_NAME', expected 'truckzen'. Run from the truckzen repo root."

[ -f .vercel/project.json ] || fail "Missing .vercel/project.json. Run 'npx vercel link' first, or run from a worktree linked to Vercel."

ACTUAL_PROJECT_ID=$(node -p "require('./.vercel/project.json').projectId" 2>/dev/null || echo "")
[ "$ACTUAL_PROJECT_ID" = "$EXPECTED_PROJECT_ID" ] \
  || fail "Vercel project mismatch: got '$ACTUAL_PROJECT_ID', expected '$EXPECTED_PROJECT_ID'. Refusing to deploy."

green "[1/9] Repo identity OK: $(pwd)"

# ── 2. Explicit human confirmation ────────────────────────────────────────────
[ "${I_UNDERSTAND_PRODUCTION:-}" = "YES" ] \
  || fail "Refusing to deploy without I_UNDERSTAND_PRODUCTION=YES. This will replace https://${PROD_DOMAIN}/."

green "[2/9] Production confirmation acknowledged."

# ── 3. Clean working tree ─────────────────────────────────────────────────────
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  red "Working tree is dirty:"
  echo "$DIRTY" >&2
  fail "Refusing to deploy from a dirty tree. Commit, stash, or discard first."
fi
green "[3/9] Working tree clean."

# ── 4. Branch allowlist ───────────────────────────────────────────────────────
BRANCH=$(git branch --show-current)
[ -n "$BRANCH" ] || fail "Detached HEAD or no current branch. Refusing to deploy."

if ! [[ "$BRANCH" =~ $ALLOWED_PROD_BRANCH_REGEX ]]; then
  fail "Branch '$BRANCH' is not allowed for production. Allowed regex: '$ALLOWED_PROD_BRANCH_REGEX'.
        Override with ALLOWED_PROD_BRANCH_REGEX env var ONLY if this is an intentional release branch."
fi
green "[4/9] Branch OK: $BRANCH"

# ── Production lineage check ─────────────────────────────────────────────────
# A prod deploy replaces the entire live snapshot. Refuse to deploy if HEAD
# is missing any accepted-live UI/design commit — see the Production Lineage
# Rule in docs/deploy/TRUCKZEN_PRODUCTION_LINEAGE_RULE.md.
yellow "[lineage] Production lineage check:"
LINEAGE_MISSING=0
for LIVE_COMMIT in "${REQUIRED_LIVE_COMMITS[@]}"; do
  if git merge-base --is-ancestor "$LIVE_COMMIT" HEAD 2>/dev/null; then
    echo "  OK   $LIVE_COMMIT is an ancestor of HEAD"
  else
    red "  MISS $LIVE_COMMIT is NOT an ancestor of HEAD"
    LINEAGE_MISSING=1
  fi
done
[ "$LINEAGE_MISSING" -eq 0 ] \
  || fail "Production lineage check failed. HEAD is missing required live commit(s). See docs/deploy/TRUCKZEN_PRODUCTION_LINEAGE_RULE.md."
green "[lineage] All required live commits present."

# ── Print HEAD identity ───────────────────────────────────────────────────────
HEAD_SHA=$(git rev-parse HEAD)
HEAD_SHORT=$(git rev-parse --short HEAD)
HEAD_MSG=$(git log -1 --format=%s)
bold ""
bold "  Branch:  $BRANCH"
bold "  Commit:  $HEAD_SHORT  $HEAD_MSG"
bold "  Full:    $HEAD_SHA"
bold ""

# ── 5. Build (fail-closed) ────────────────────────────────────────────────────
yellow "[5/9] Running production build (npm run build)…"
npm run build || fail "Build failed. Refusing to deploy."
green "[5/9] Build succeeded."

# ── 6. Alias owner BEFORE deploy ──────────────────────────────────────────────
yellow "[6/9] $PROD_DOMAIN alias owner BEFORE deploy:"
BEFORE_OUT=$(npx vercel inspect "$PROD_DOMAIN" --scope "$EXPECTED_ORG_ID" 2>&1 || true)
echo "$BEFORE_OUT" | grep -E '^\s+(id|target|status|url|created)' || fail "Could not inspect $PROD_DOMAIN before deploy."

# ── 7. Deploy ─────────────────────────────────────────────────────────────────
yellow "[7/9] Deploying to production…"
DEPLOY_LOG=$(mktemp)
trap 'rm -f "$DEPLOY_LOG"' EXIT

if ! npx vercel --prod --yes --scope "$EXPECTED_ORG_ID" 2>&1 | tee "$DEPLOY_LOG"; then
  fail "Deploy failed."
fi

DEPLOY_URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' "$DEPLOY_LOG" | tail -1)
[ -n "$DEPLOY_URL" ] || fail "Could not extract deployment URL from Vercel CLI output."
green "[7/9] Deployed: $DEPLOY_URL"

# ── 8. Alias owner AFTER deploy ───────────────────────────────────────────────
yellow "[8/9] $PROD_DOMAIN alias owner AFTER deploy:"
AFTER_OUT=$(npx vercel inspect "$PROD_DOMAIN" --scope "$EXPECTED_ORG_ID" 2>&1 || true)
echo "$AFTER_OUT" | grep -E '^\s+(id|target|status|url|created)' || fail "Could not inspect $PROD_DOMAIN after deploy."

AFTER_ID=$(echo "$AFTER_OUT" | awk '/^[[:space:]]+id[[:space:]]/{print $2; exit}')
AFTER_URL=$(echo "$AFTER_OUT" | awk '/^[[:space:]]+url[[:space:]]/{print $2; exit}')

if [ -n "$AFTER_URL" ] && [ "$AFTER_URL" != "$DEPLOY_URL" ]; then
  red "WARNING: $PROD_DOMAIN points to '$AFTER_URL', not the deployment we just created ('$DEPLOY_URL')."
  red "         Alias did NOT auto-promote. Investigate before considering this deploy live."
  fail "Alias-after-deploy mismatch."
fi

# ── 9. Live verification ──────────────────────────────────────────────────────
yellow "[9/9] Live verification:"
TS=$(date +%s)
ROOT_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "https://${PROD_DOMAIN}/?_v=${TS}")
LOGIN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "https://${PROD_DOMAIN}/login?_v=${TS}")
echo "  /        -> HTTP $ROOT_STATUS"
echo "  /login   -> HTTP $LOGIN_STATUS"
if [ "$ROOT_STATUS" != "200" ] || [ "$LOGIN_STATUS" != "200" ]; then
  fail "Live verification failed. /=$ROOT_STATUS  /login=$LOGIN_STATUS"
fi
green "[9/9] Live endpoints return 200."

# ── Summary + manual checklist ────────────────────────────────────────────────
bold ""
bold "=========================================================="
bold "  PRODUCTION DEPLOY COMPLETE"
bold "=========================================================="
echo "  Branch deployed:     $BRANCH"
echo "  Commit:              $HEAD_SHORT  $HEAD_MSG"
echo "  Deployment URL:      $DEPLOY_URL"
echo "  Alias now points to: ${AFTER_ID:-unknown}"
echo ""
echo "Manually verify in a hard-refreshed browser tab (or private window):"
echo "  1. https://${PROD_DOMAIN}/        — landing renders the intended design"
echo "  2. https://${PROD_DOMAIN}/login   — login renders the intended design"
echo "  3. Sign in and spot-check one critical authenticated route"
echo ""
echo "If the live page looks wrong despite this script succeeding, see:"
echo "  docs/deploy/TRUCKZEN_PRODUCTION_DEPLOY_RUNBOOK.md  →  'If alias drifts again'"
