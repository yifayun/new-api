#!/usr/bin/env bash
# Sync local custom branch with https://github.com/QuantumNous/new-api
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="${UPSTREAM_REMOTE:-upstream}"
BRANCH="${UPSTREAM_BRANCH:-main}"

echo "==> Fetching ${REMOTE}/${BRANCH} ..."
if ! git fetch "$REMOTE" "$BRANCH"; then
  echo "ERROR: git fetch failed. Check network/proxy, then re-run." >&2
  exit 1
fi

CURRENT="$(git branch --show-current)"
echo "==> Current branch: ${CURRENT}"

if ! git merge-base --is-ancestor "${REMOTE}/${BRANCH}" HEAD 2>/dev/null; then
  echo "==> Merging ${REMOTE}/${BRANCH} ..."
  git merge "${REMOTE}/${BRANCH}" -m "Merge ${REMOTE}/${BRANCH} into ${CURRENT}"
else
  BEHIND="$(git rev-list --count HEAD.."${REMOTE}/${BRANCH}")"
  if [[ "$BEHIND" -gt 0 ]]; then
    echo "==> Fast-forwarding ${BEHIND} commit(s) ..."
    git merge --ff-only "${REMOTE}/${BRANCH}"
  else
    echo "==> Already up to date with ${REMOTE}/${BRANCH}."
  fi
fi

echo "==> Done. Upstream tip: $(git rev-parse --short ${REMOTE}/${BRANCH})"
