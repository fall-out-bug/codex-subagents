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

The package is not published yet. As of May 12, 2026, `npm view @fall-out-bug/codex-subagents` returns `E404`.

### The auth problem

`npm login` is not enough when the account or package requires 2FA for publishing. The registry can still reject `npm publish` with:

```text
Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

Use one of these two paths.

### Preferred: token publish

Create a granular access token on npm:

1. Open npmjs.com -> profile menu -> Access Tokens.
2. Generate a new granular token.
3. Give it `Read and write` package access for `@fall-out-bug/codex-subagents` or the `@fall-out-bug` scope.
4. Enable `Bypass two-factor authentication` for write actions.
5. Copy the token immediately; npm will not show it again.

Then run:

```bash
export NODE_AUTH_TOKEN=npm_...
./scripts/publish-npm.sh
```

The script creates a temporary npm user config for that token, verifies `npm whoami`, runs `npm run check`, verifies the version is not already published, and runs:

```bash
npm publish --access public
```

Do not paste npm tokens into chat. Set `NODE_AUTH_TOKEN` in the local shell or as a repository secret.

### Fallback: OTP publish

If using interactive account auth instead of a bypass-2FA token:

```bash
npm login
NPM_OTP=123456 ./scripts/publish-npm.sh
```

Use a fresh OTP. It expires quickly. This is more fragile for agent-driven publishing because the agent cannot safely ask for or store 2FA secrets.

### Provenance

For local manual publishing, provenance is disabled by default. To request provenance explicitly:

```bash
NPM_PROVENANCE=1 NODE_AUTH_TOKEN=npm_... ./scripts/publish-npm.sh
```

The GitHub release workflow publishes with provenance.

GitHub Actions publish:

1. Add repository secret `NPM_TOKEN`.
   - Use the same granular npm token with write access and Bypass 2FA enabled.
2. Create and push a version tag:

```bash
git tag v0.3.0
git push origin v0.3.0
```

The release workflow publishes npm and creates a GitHub release with the npm tarball attached.

### Trusted publishing option

npm also supports Trusted Publishing through GitHub Actions OIDC. That removes long-lived npm tokens. If configured on npm for this package and workflow, the release workflow can publish without `NPM_TOKEN`. Until that is configured, use `NPM_TOKEN`.

Required user action so Codex does not get blocked by login:

- For local publishing: export `NODE_AUTH_TOKEN` with a granular write token that bypasses 2FA.
- For GitHub publishing: add the same token as repository secret `NPM_TOKEN`.
- If not using a token: provide a fresh OTP as `NPM_OTP` at publish time.

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
