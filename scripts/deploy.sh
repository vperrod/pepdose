#!/usr/bin/env bash
# Build and deploy pepdose to the claude-dev VM (served by Caddy at /pepdose/).
#
# Replaces .github/workflows/deploy.yml, which cannot run while the GitHub
# account is blocked (Actions disabled account-wide, ticket 4583559).
#
# Usage: scripts/deploy.sh [--skip-tests]
#
# Supabase config comes from .env.local (gitignored) — vite loads it
# automatically. Both values are public-safe: the URL is public and the
# publishable key is protected by row-level security.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TARGET="${PEPDOSE_TARGET:-/srv/pepdose}"

[[ -r .env.local ]] || {
  echo "ERROR: .env.local missing — build would ship without Supabase config" >&2
  echo "       needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)" >&2
  exit 1
}
grep -q '^VITE_SUPABASE_URL=.\+' .env.local && grep -q '^VITE_SUPABASE_ANON_KEY=.\+' .env.local || {
  echo "ERROR: .env.local is missing or has an empty Supabase value" >&2
  exit 1
}

echo "==> npm ci"
npm ci

if [[ "${1:-}" != "--skip-tests" ]]; then
  echo "==> tests"
  npm test
fi

echo "==> build"
npm run build

# vite.config keeps base: '/pepdose/', which matches the Caddy `handle_path
# /pepdose*` route. Do NOT "fix" it to '/': the matching subpath is exactly what
# lets this app move back to GitHub Pages untouched when the account is restored.
grep -q "base: '/pepdose/'" vite.config.ts || {
  echo "WARNING: vite base is no longer '/pepdose/' — assets will 404 behind Caddy" >&2
}

# A changed sw.js only reaches installed clients if CACHE_NAME also changed
# (commit 079c697: a fix shipped but never replaced the cached shell). Compare
# against the copy currently deployed, since deploys are not 1:1 with commits.
SW_WARN=""
if [[ -r "$TARGET/sw.js" ]] && ! cmp -s "$TARGET/sw.js" dist/sw.js; then
  old_cache=$(grep -m1 '^const CACHE_NAME' "$TARGET/sw.js" || true)
  new_cache=$(grep -m1 '^const CACHE_NAME' dist/sw.js || true)
  [[ "$old_cache" == "$new_cache" ]] && SW_WARN=1
fi

echo "==> deploy to $TARGET"
sudo /usr/bin/rsync -a --delete --chown=caddy:caddy dist/ "$TARGET/"

DEPLOY_LOG="docs/DEPLOY_LOG.md"
[[ -r "$DEPLOY_LOG" ]] || printf '# Deploy log\n\n| UTC time | Commit | Deployed by |\n|---|---|---|\n' > "$DEPLOY_LOG"
printf '| %s | %s | %s |\n' \
  "$(date -u +'%Y-%m-%d %H:%M:%S')" \
  "$(git rev-parse --short HEAD)" \
  "$(git config user.name || whoami)" >> "$DEPLOY_LOG"

echo
echo "Deployed: https://claude-dev-vperrod.westeurope.cloudapp.azure.com/pepdose/"
echo "Logged to $DEPLOY_LOG — verify the change is live at that URL before moving on."
if [[ -n "$SW_WARN" ]]; then
  echo "WARNING: public/sw.js changed but CACHE_NAME did not — installed clients" >&2
  echo "         will keep the old service worker/shell. Bump CACHE_NAME and redeploy." >&2
fi
