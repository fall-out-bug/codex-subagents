#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

package_name="$(node -p "require('./package.json').name")"
package_version="$(node -p "require('./package.json').version")"

publish_args=(--access public)
if [[ "${NPM_PROVENANCE:-0}" == "1" ]]; then
  publish_args+=(--provenance)
fi
if [[ -n "${NPM_OTP:-}" ]]; then
  publish_args+=(--otp "$NPM_OTP")
fi

tmp_userconfig=""
cleanup() {
  if [[ -n "$tmp_userconfig" ]]; then
    rm -f "$tmp_userconfig"
  fi
}
trap cleanup EXIT

if [[ -n "${NODE_AUTH_TOKEN:-}" ]]; then
  tmp_userconfig="$(mktemp)"
  {
    echo "registry=https://registry.npmjs.org/"
    echo "//registry.npmjs.org/:_authToken=\${NODE_AUTH_TOKEN}"
  } > "$tmp_userconfig"
  export NPM_CONFIG_USERCONFIG="$tmp_userconfig"
fi

if ! npm whoami >/dev/null 2>&1; then
  cat >&2 <<'EOF'
npm is not authenticated.

Preferred non-interactive options:
  1. Export a granular npm token with write access and Bypass 2FA enabled:
     export NODE_AUTH_TOKEN=npm_...
  2. Or publish interactively with an OTP:
     NPM_OTP=123456 ./scripts/publish-npm.sh

For GitHub Actions, add the token as repository secret NPM_TOKEN.
EOF
  exit 1
fi

published_version="$(npm view "$package_name" version 2>/dev/null || true)"
if [[ "$published_version" == "$package_version" ]]; then
  echo "$package_name@$package_version is already published" >&2
  exit 1
fi

npm run check
npm publish "${publish_args[@]}"
