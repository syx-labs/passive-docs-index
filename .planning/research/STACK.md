# Stack Research: PDI v0.3.0 Milestone

**Domain:** CLI Dev Tools / AI Documentation Indexing
**Researched:** 2026-02-05
**Overall Confidence:** HIGH (most recommendations verified with Context7/official docs)

---

## Context

This research covers the NEW technologies needed for PDI's next milestone: testing, CI/CD, npm publishing, VS Code extension, Claude Code skills/hooks, and git hooks. It does NOT re-research the existing stack (Commander.js 13, Chalk 5, Context7 SDK, Bun, TypeScript 5.7 -- all already chosen and working).

**Key Constraint:** PDI targets Node.js 18+ for broad compatibility. This constraint significantly impacts testing framework choice.

---

## Recommended Stack

### 1. Testing Framework

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Bun Test | built-in (Bun 1.x) | Unit + Integration testing | Already in stack (`bun test` in package.json), zero additional deps, fastest execution, Jest-compatible API, built-in mocking and coverage | HIGH |

**Critical finding: Vitest 4.0 requires Node.js >= 20.0.0** (via Vite 6+ dependency). Even Vitest 3.2+ requires Node >= 20.19 (via Vite 7). Since PDI targets Node.js 18+, Vitest is NOT viable without raising the minimum Node version. Bun Test is the correct choice -- it's already configured, has zero dependencies, runs tests in milliseconds, and provides:

- `describe`/`it`/`expect` (Jest-compatible API)
- `mock.module()` for ESM module mocking
- `--coverage` flag for code coverage reports
- `--coverage-threshold` for enforcing minimums
- Snapshot testing
- Async/await support

**Testing architecture:**
- **Unit tests**: Pure function testing via `bun test` (config parsing, template matching, index formatting)
- **Integration tests**: Command-level testing with mocked fs/network via `bun test` with `mock.module()`
- **E2E tests**: Subprocess-based CLI invocation via `bun test` calling `bun run dist/cli.js`

**Source:** Context7 `/vitest-dev/vitest` confirmed Node >= 20.0.0 requirement. Bun docs confirm built-in test runner capabilities.

### 2. CI/CD Pipeline

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| GitHub Actions | N/A | CI/CD orchestration | Project already on GitHub, native integration, free for open source, mature Node.js/Bun support | HIGH |
| `actions/checkout` | v5 | Repository checkout | Standard, latest version | HIGH |
| `actions/setup-node` | v4 | Node.js environment | Required for npm publish with provenance, supports registry auth | HIGH |
| `oven-sh/setup-bun` | v2 | Bun runtime setup | Official Bun action, required for `bun test` and `bun build` in CI | HIGH |
| npm provenance | built-in | Supply chain security | npm trusted publishing is GA (July 2025), auto-generates Sigstore attestations, builds trust for new packages | MEDIUM |

**Pipeline structure:**

```yaml
# ci.yml - runs on every push/PR
- Checkout
- Setup Bun
- Install deps (bun install)
- Lint (bun run check)
- Typecheck (bun run typecheck)
- Test (bun test --coverage)
- Build (bun run build)

# publish.yml - runs on GitHub Release creation
- Checkout
- Setup Node (for npm publish with provenance)
- Setup Bun (for build)
- Install + Build + Test
- npm publish --provenance --access public
```

**Critical note:** `bun publish` does NOT support `--provenance` flag (GitHub issue #15601 open since Dec 2024, still unresolved). Must use `npm publish` for provenance attestations. Use Bun for everything else (install, test, build) and Node.js/npm only for the actual publish step.

**Source:** GitHub Actions docs (Context7 `/websites/github_en_actions`), npm provenance docs, Bun GitHub issue #15601.

### 3. Version Management & Changelogs

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `@changesets/cli` | ^2.29.8 | Version bumping + changelog generation | Works with single-package repos, generates CHANGELOG.md, integrates with GitHub Actions via `changesets/action`, battle-tested in npm ecosystem | HIGH |
| `changesets/action` | v1 | GitHub Action for automated releases | Creates "Version Packages" PR automatically, publishes on merge | HIGH |

**Why Changesets over alternatives:**
- **vs `semantic-release`**: Changesets is simpler for single packages, doesn't require commit convention parsing, gives explicit control over version bumps
- **vs manual `npm version`**: Changesets generates changelogs, works in CI, prevents forgotten bumps
- **vs `release-it`**: Changesets has better GitHub Actions integration and is more widely adopted

**Workflow:** Developer adds changeset (`npx changeset`) describing change -> CI creates PR bumping version + updating CHANGELOG -> Merge PR triggers publish.

**Source:** Context7 `/changesets/changesets`, npm registry.

### 4. VS Code Extension

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| `@vscode/vsce` | ^3.x | Extension packaging + publishing | Official Microsoft tool, required for VS Code Marketplace | HIGH |
| `yo generator-code` | latest | Scaffold extension project | Official VS Code extension generator, supports TypeScript + esbuild | HIGH |
| esbuild | bundled via generator | Extension bundling | Fast, recommended by VS Code docs for extension bundling | HIGH |
| `@types/vscode` | ^1.96.0 | VS Code API types | Required for TypeScript extension development | HIGH |

**Architecture decision:** The VS Code extension should be a SEPARATE package, not bundled into the CLI. Reasons:
- Different dependency trees (VS Code API vs CLI deps)
- Different distribution channels (VS Code Marketplace vs npm)
- Different Node.js requirements (`@vscode/vsce` requires Node >= 20)
- Can import from `passive-docs-index` npm package as a dependency

**Recommended structure:**
```
packages/
  vscode-pdi/          # VS Code extension (separate package.json)
    src/extension.ts
    package.json        # @types/vscode, esbuild
```

**Key features to build:**
- Tree view showing PDI index contents
- Command palette: `PDI: Sync`, `PDI: Status`, `PDI: Add`
- Status bar item showing index health
- Webview for index visualization (optional, later phase)

**Note:** Node.js 20+ is required for `@vscode/vsce`. This only affects the extension build/publish toolchain, NOT the CLI's runtime requirement. Users installing the VS Code extension don't need to worry about Node versions.

**Source:** VS Code official docs (Context7 `/microsoft/vscode-docs`), npm `@vscode/vsce` page.

### 5. Claude Code Skills & Hooks

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Claude Code Skills | N/A (file-based) | Custom `/pdi-*` slash commands | Zero deps, file-based config, auto-discovered by Claude Code, follows Agent Skills open standard | HIGH |
| Claude Code Hooks | N/A (settings.json) | Automated triggers on git/install events | Zero deps, deterministic execution, supports PreToolUse/PostToolUse/Stop hooks | HIGH |

**Skills architecture:**

Skills are markdown files with YAML frontmatter. They live in `.claude/skills/` and become `/skill-name` slash commands.

```
.claude/
  skills/
    pdi-analyze/
      SKILL.md            # Frontmatter + instructions
      PATTERNS.md         # Reference: common analysis patterns
    pdi-generate/
      SKILL.md
      templates/          # Supporting files
```

**SKILL.md format:**
```yaml
---
name: pdi-analyze
description: Analyzes project documentation coverage, detects undocumented frameworks, suggests PDI improvements. Use when checking docs status or finding missing documentation.
allowed-tools: Read, Grep, Glob, Bash(pdi *)
---

[Markdown instructions for Claude]
```

**Key frontmatter fields:**
- `name`: Skill identifier, becomes `/name` command (max 64 chars, lowercase/hyphens)
- `description`: Trigger criteria -- Claude uses this to decide when to auto-apply (max 1024 chars, MUST be single line or discovery breaks)
- `allowed-tools`: Tool whitelist when skill is active
- `disable-model-invocation`: Set `true` for manual-only skills
- `context`: Set `fork` for isolated subagent execution
- `argument-hint`: Autocomplete hint like `[framework-name]`

**Hooks architecture:**

Hooks are configured in `.claude/settings.json` (project-level, committable) or `.claude/settings.local.json` (personal, gitignored).

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/suggest-sync.sh"
          }
        ]
      }
    ]
  }
}
```

**Hook types relevant to PDI:**
- `PostToolUse` with `Bash` matcher: Detect `npm install`/`bun install` and suggest `pdi sync`
- `Stop`: Verify documentation is up-to-date after task completion
- `PreToolUse`: Could validate docs are fresh before Claude uses them

**Hook event lifecycle:**
| Event | When | Use Case |
|-------|------|----------|
| `PreToolUse` | Before tool call | Validate, block dangerous ops |
| `PostToolUse` | After tool succeeds | Auto-format, suggest sync |
| `Stop` | Claude finishes responding | Verify completeness |
| `Notification` | Claude needs attention | Desktop alerts |
| `SessionStart` | Session begins/resumes | Inject context |

**Exit codes:** 0 = proceed, 2 = block (stderr becomes feedback to Claude), other = proceed with logged warning.

**Source:** Official Claude Code docs at `code.claude.com/docs/en/hooks-guide` and `code.claude.com/docs/en/skills`.

### 6. Git Hooks Management

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Husky | ^9.1.7 | Git hooks management | 2kB, no deps, ~1ms overhead, massive adoption (7M+ weekly npm downloads), dead simple setup | HIGH |
| lint-staged | ^16.2.7 | Run linters on staged files | Standard pairing with Husky, runs Biome only on changed files, 2200+ dependents | HIGH |

**Why Husky over Lefthook:**
- Husky is the JS ecosystem standard (7M+ weekly downloads vs Lefthook's smaller base)
- PDI is a pure JS/TS project -- no need for Lefthook's polyglot features
- Husky v9 is ultra-minimal (2kB, shell scripts in `.husky/` folder)
- Team familiarity -- any JS developer knows Husky

**Setup:**
```bash
npx husky init
```

This creates `.husky/` directory and adds `"prepare": "husky"` to package.json scripts.

**Hook scripts:**
```bash
# .husky/pre-commit
bun run check          # Biome lint
bun run typecheck      # TypeScript check
bun test --bail        # Run tests, fail fast
```

**With lint-staged (recommended):**
```json
// package.json
{
  "lint-staged": {
    "*.{ts,js,json}": ["biome check --write"]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

**Source:** Context7 `/websites/typicode_github_io_husky`, npm registry for version info.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@changesets/cli` | ^2.29.8 | Version management + changelogs | Every release cycle |
| `husky` | ^9.1.7 | Git hooks | Development workflow |
| `lint-staged` | ^16.2.7 | Staged file linting | Pre-commit checks |
| `@vscode/vsce` | ^3.x | VS Code extension packaging | Extension publish (separate package) |
| `@types/vscode` | ^1.96.0 | VS Code API types | Extension development |
| `esbuild` | ^0.24.x | Extension bundling | Extension build |

---

## Installation

### CLI Package (existing + new dev deps)

```bash
# New dev dependencies for testing/CI/hooks
bun add -D @changesets/cli husky lint-staged

# Initialize changesets
npx changeset init

# Initialize husky
npx husky init
```

### VS Code Extension Package (separate)

```bash
# In packages/vscode-pdi/
npm init -y
npm install -D @types/vscode @vscode/vsce esbuild typescript
```

### Claude Code Skills/Hooks (no installation)

Skills and hooks are file-based -- create `.claude/skills/` and `.claude/settings.json` directly. Zero npm dependencies.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Testing | Bun Test (built-in) | Vitest 4.0 | Requires Node >= 20.0.0; PDI targets Node 18+. Adding Vitest would either break compat or require maintaining two test configs |
| Testing | Bun Test (built-in) | Jest | ESM support is painful, requires babel transforms, slower than both Bun and Vitest, declining ecosystem momentum |
| Testing | Bun Test (built-in) | Node.js Test Runner | Requires Node 18.13+ for stability, API less mature, worse DX than Bun Test, no snapshot support until Node 22 |
| Git Hooks | Husky 9 | Lefthook | Lefthook better for polyglot/monorepo; PDI is single-package JS -- Husky's simplicity wins |
| Git Hooks | Husky 9 | simple-git-hooks | Fewer features, smaller community, Husky is the standard |
| Versioning | Changesets | semantic-release | semantic-release requires conventional commits, more complex setup, overkill for single package |
| Versioning | Changesets | npm version (manual) | No changelog generation, easy to forget, not CI-friendly |
| CI/CD | GitHub Actions | GitLab CI | Project is on GitHub; native integration is superior |
| Extension Bundler | esbuild | webpack | esbuild is 10-100x faster, simpler config, recommended by VS Code generator |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Vitest (any version) | Requires Node >= 20 via Vite 6+/7 dependency; breaks PDI's Node 18+ compat target | Bun Test (built-in) |
| Jest | Poor ESM support, requires complex babel setup for TypeScript ESM, slow | Bun Test (built-in) |
| `bun publish --provenance` | Provenance flag not implemented in Bun (GitHub issue #15601, still open) | `npm publish --provenance` in CI |
| Prettier | Biome already handles formatting; adding Prettier is redundant and slower | Biome (already in stack via Ultracite) |
| ESLint | Biome already handles linting; dual linters cause conflicts | Biome (already in stack via Ultracite) |
| commitlint | Adds complexity; Changesets handles version semantics; Biome handles code quality | Changesets for versioning, Husky for hooks |
| webpack (for VS Code ext) | Slow, complex config, esbuild is recommended modern alternative | esbuild |
| `semantic-release` | Over-engineered for single-package repo, requires commit conventions | Changesets |
| Monorepo tools (nx, turborepo) | Premature -- only 2 packages (CLI + VS Code ext). Add when/if complexity warrants | Simple npm workspaces if needed |

---

## Version Compatibility Matrix

| Technology | Min Node.js | PDI Compatible? | Notes |
|------------|-------------|-----------------|-------|
| Bun Test | Bun runtime | YES | Runs in Bun, outputs Node 18+ compatible code |
| Husky 9 | Node 18+ | YES | Lightweight, no Node version issues |
| lint-staged 16 | Node 18.12+ | YES | Within PDI's target range |
| @changesets/cli 2 | Node 14+ | YES | Very broad compatibility |
| GitHub Actions | N/A | YES | Runs in cloud, controls own Node version |
| @vscode/vsce 3 | Node 20+ | N/A | Only for extension build/publish, not CLI runtime |
| Vitest 4 | Node 20+ | NO | Breaks Node 18+ compat requirement |
| Vitest 3.2+ | Node 20.19+ | NO | Vite 7 dropped Node 18 (EOL April 2025) |

---

## Future Consideration: Dropping Node 18

Node.js 18 reached EOL on April 30, 2025. If PDI decides to raise minimum to Node 20+ (reasonable for a new tool), Vitest becomes viable. However:

1. Bun Test is already working and has zero additional deps
2. Adding Vitest adds ~50+ transitive deps (Vite + plugins)
3. The Bun Test API is Jest-compatible, so migration would be straightforward if ever needed
4. Users on Node 18 (legacy CI environments, older LTS) would be excluded

**Recommendation:** Keep Node 18+ target for v0.3.0. Revisit for v1.0.0 when the user base is established and Node 18 usage data is available.

---

## Sources

### HIGH Confidence (Context7 + Official Docs)
- Vitest requirements: Context7 `/vitest-dev/vitest` -- confirmed Node >= 20.0.0
- GitHub Actions npm publishing: Context7 `/websites/github_en_actions` -- workflow examples verified
- Changesets CLI: Context7 `/changesets/changesets` -- single-package workflow confirmed
- Husky setup: Context7 `/websites/typicode_github_io_husky` -- v9 configuration verified
- VS Code extension API: Context7 `/microsoft/vscode-docs` -- extension development patterns
- Claude Code Hooks: [Official hooks guide](https://code.claude.com/docs/en/hooks-guide) -- full event schema
- Claude Code Skills: [Official skills docs](https://code.claude.com/docs/en/skills) -- SKILL.md format and frontmatter

### MEDIUM Confidence (Verified WebSearch)
- npm provenance/trusted publishing: [npm docs](https://docs.npmjs.com/trusted-publishers/) -- GA since July 2025
- `bun publish` provenance gap: [Bun GitHub issue #15601](https://github.com/oven-sh/bun/issues/15601)
- lint-staged v16.2.7: [npm registry](https://www.npmjs.com/package/lint-staged)
- @vscode/vsce Node 20 requirement: [npm registry](https://www.npmjs.com/package/@vscode/vsce)
- Vitest 4.0.18 release: [Vitest blog](https://vitest.dev/blog/vitest-4)

### LOW Confidence (WebSearch Only)
- Lefthook vs Husky adoption numbers: Multiple blog comparisons, not independently verified
- esbuild as default VS Code bundler recommendation: Blog posts, not in official VS Code docs (webpack is the documented default, esbuild supported via generator flag)
