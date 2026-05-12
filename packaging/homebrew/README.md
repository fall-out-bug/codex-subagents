# Homebrew Packaging

Publish Homebrew after a tagged GitHub release exists.

Target install UX:

```bash
brew tap fall-out-bug/tap
brew install codex-subagents
```

Tap repo:

```text
fall-out-bug/homebrew-tap
```

Formula path in the tap:

```text
Formula/codex-subagents.rb
```

The formula should use a stable release tarball and SHA256. Do not point Homebrew at a moving branch.

Release sequence:

1. Publish npm package or create GitHub release from a `vX.Y.Z` tag.
2. Download the release tarball.
3. Compute SHA256:

```bash
curl -L -o codex-subagents.tgz <release-tarball-url>
shasum -a 256 codex-subagents.tgz
```

4. Update the tap formula.
5. Verify:

```bash
brew install --build-from-source fall-out-bug/tap/codex-subagents
codex-subagent --version
```

Formula template:

```ruby
class CodexSubagents < Formula
  desc "Launch pi, OpenCode, and GSD2 agents as external subagents from Codex"
  homepage "https://github.com/fall-out-bug/codex-subagents"
  url "https://registry.npmjs.org/@fall_out_bug/codex-subagents/-/codex-subagents-VERSION.tgz"
  sha256 "SHA256"
  license "MIT"

  depends_on "node"

  def install
    libexec.install Dir["*"]
    bin.install_symlink libexec/"dist/cli.js" => "codex-subagent"
    bin.install_symlink libexec/"dist/cli.js" => "codex-subagents"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/codex-subagent --version")
  end
end
```

If the npm tarball layout changes, inspect it before updating the formula.
