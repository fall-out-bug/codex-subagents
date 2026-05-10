# Publishing

The unscoped npm name `codex-subagents` is already taken. This project publishes as:

```text
@fall-out-bug/codex-subagents
```

The CLI binaries remain:

```text
codex-subagent
codex-subagents
```

## npm

Manual publish:

```bash
npm login
./scripts/publish-npm.sh
```

The script verifies npm authentication, checks whether the current version already exists, runs `npm run check`, and publishes with public access and npm provenance.

GitHub Actions publish:

1. Add repository secret `NPM_TOKEN`.
2. Create and push a version tag:

```bash
git tag v0.3.0
git push origin v0.3.0
```

The release workflow publishes npm and creates a GitHub release with the npm tarball attached.

## Homebrew

Use a tap repo:

```bash
gh repo create fall-out-bug/homebrew-tap --public
```

Formula target:

```text
fall-out-bug/tap/codex-subagents
```

Recommended install UX:

```bash
brew tap fall-out-bug/tap
brew install codex-subagents
```

Update the tap after a tagged GitHub release exists, because the formula needs a stable URL and SHA256. See [`../packaging/homebrew/README.md`](../packaging/homebrew/README.md).

## Local Agent Install

For local Codex skills and CLI linking, use:

```bash
./scripts/install-local-codex.sh
```

See [`AGENT_INSTALL.md`](AGENT_INSTALL.md).
