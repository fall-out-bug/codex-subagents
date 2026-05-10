#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
codex_skills_dir="${CODEX_SKILLS_DIR:-$HOME/.codex/skills}"

cd "$repo_root"

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run build
npm link

mkdir -p "$codex_skills_dir"

for skill in subagent-review subagent-council subagent-dev subagent-research; do
  src="$repo_root/skills/$skill"
  dest="$codex_skills_dir/$skill"

  if [[ -e "$dest" && ! -L "$dest" ]]; then
    echo "Refusing to replace non-symlink skill: $dest" >&2
    exit 1
  fi

  ln -sfn "$src" "$dest"
done

codex-subagent --version

echo "Installed codex-subagent CLI and skills into $codex_skills_dir"
