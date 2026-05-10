#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

package_name="$(node -p "require('./package.json').name")"
package_version="$(node -p "require('./package.json').version")"

if ! npm whoami >/dev/null 2>&1; then
  echo "npm is not authenticated. Run: npm login" >&2
  exit 1
fi

published_version="$(npm view "$package_name" version 2>/dev/null || true)"
if [[ "$published_version" == "$package_version" ]]; then
  echo "$package_name@$package_version is already published" >&2
  exit 1
fi

npm run check
npm publish --access public --provenance
