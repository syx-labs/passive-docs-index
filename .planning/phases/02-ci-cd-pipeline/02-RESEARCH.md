# Phase 2: CI/CD Pipeline - Research

**Researched:** 2026-02-05
**Domain:** GitHub Actions, Bun CI, Biome linting, branch protection
**Confidence:** HIGH

## Summary

This phase sets up a GitHub Actions workflow for the passive-docs-index project that runs lint (Biome via ultracite), typecheck (tsc), and tests (bun test) on every push to `main` and every PR targeting `main`. It also configures branch protection rules via `gh` CLI and adds Shields.io badges to the README.

The standard approach uses `oven-sh/setup-bun@v2` for Bun installation, `biome ci --reporter=github` for lint with inline annotations, a custom tsc problem matcher for typecheck annotations, the existing `scripts/check-coverage.ts` for coverage enforcement, and `zgosalvez/github-actions-report-lcov@v4` for PR coverage comments. Coverage badge uses `Schneegans/dynamic-badges-action@v1.7.0` with a GitHub Gist endpoint.

**Primary recommendation:** A single workflow file with one sequential job (lint, typecheck, test, coverage report), using `biome ci` directly (not `ultracite check`) for GitHub annotation support, and carefully avoiding `paths-ignore` at workflow level to prevent branch protection deadlock.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Runs on push to `main` and PRs targeting `main`
- Draft PRs do NOT trigger CI -- only ready-for-review
- Path filtering active: ignore `*.md`, `.planning/`, and paths that don't affect code
- Branch principal: `main`
- Basic Bun dependency caching (no extra optimizations)
- Bun version: `latest` (always most recent, not pinned)
- No version matrix -- single version only
- Single sequential job: Lint -> Typecheck -> Test (fail-fast)
- CI required for merge (no review approval required -- solo project)
- Direct push to `main` blocked -- everything via PR
- Force push to `main` blocked -- history preserved
- Branch protection configured automatically via `gh` CLI (script)
- Status badge: Shields.io custom (not native GitHub)
- Coverage badge: Shields.io in README (in addition to CI badge)
- Coverage report as automatic PR comment with threshold (80%)
- Lint/typecheck errors as inline annotations on PR files

### Claude's Discretion
- Choice of action for coverage report (e.g., codecov, custom script)
- Exact format of Shields.io badges
- Path filtering details (which paths to ignore beyond *.md and .planning/)
- Exact Bun cache configuration

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `oven-sh/setup-bun` | `@v2` | Install Bun in runner | Official, verified GitHub Action from Bun team |
| `biome ci` | 2.3.14 (via project) | Lint + format check in CI | Purpose-built CI command with `--reporter=github` for annotations |
| `tsc --noEmit` | 5.7.3 (via project) | Type checking | Already configured in tsconfig.json |
| `bun test --coverage` | latest | Test runner + coverage | Project's existing test command |
| `scripts/check-coverage.ts` | existing | Per-module 80% threshold | Already built and tested in Phase 1 |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `zgosalvez/github-actions-report-lcov` | `@v4` | PR coverage comments | On pull_request events only |
| `Schneegans/dynamic-badges-action` | `@v1.7.0` | Coverage badge via Gist | On push to main only |
| `actions/checkout` | `@v4` | Repo checkout | Every workflow run |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zgosalvez/github-actions-report-lcov` | Custom script with `gh pr comment` | More control but more maintenance; the action handles edge cases (update existing comment, permissions) |
| `Schneegans/dynamic-badges-action` | `codecov` | Codecov is heavier, requires account setup; Gist approach is simpler for solo project |
| `biome ci` | `ultracite check` | ultracite wraps biome but does not pass `--reporter=github`; using biome directly gets annotations |

**Installation:** No additional packages needed. All tools are already in devDependencies or available via GitHub Actions marketplace.

## Architecture Patterns

### Recommended Project Structure

```
.github/
  workflows/
    ci.yml                    # Single CI workflow
  problem-matchers/
    tsc.json                  # TypeScript problem matcher for annotations
scripts/
  setup-branch-protection.sh  # gh CLI script for branch protection
```

### Pattern 1: Single Sequential Job with Fail-Fast

**What:** All checks in one job, sequential steps, fail on first error.
**When to use:** Small projects where parallelism overhead exceeds benefit.
**Why:** Simpler, no artifact passing between jobs, fail-fast means quick feedback.

```yaml
jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - name: Lint
        run: bunx biome ci . --reporter=github
      - name: Typecheck
        run: echo "::add-matcher::.github/problem-matchers/tsc.json" && bun run typecheck
      - name: Test
        run: bun test --coverage
      - name: Check coverage thresholds
        run: bun run scripts/check-coverage.ts
      # Coverage report + badge steps (conditional)
```

### Pattern 2: Draft PR Exclusion with Job-Level Condition

**What:** Use `pull_request` with multiple types but add `if: github.event.pull_request.draft == false` at the job level.
**When to use:** When you need draft PR exclusion combined with other triggers.
**Why:** Using only `ready_for_review` type misses `synchronize` events; using all types with job-level condition is the correct approach.

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  ci:
    if: github.event.pull_request.draft == false || github.event_name == 'push'
    runs-on: ubuntu-latest
```

### Pattern 3: Path Filtering at Job Level (NOT Workflow Level)

**What:** Use `dorny/paths-filter` or conditional steps instead of `paths-ignore` at workflow level.
**When to use:** ALWAYS when the workflow is a required status check in branch protection.
**Why:** `paths-ignore` at workflow level causes required checks to stay in "Pending" state forever, blocking merges. See "Common Pitfalls" section.

**CRITICAL: Do NOT use `paths-ignore` at workflow level.** Instead, let the workflow always trigger and use a fast-exit pattern:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for code changes
        id: changes
        uses: dorny/paths-filter@v3
        with:
          filters: |
            code:
              - 'src/**'
              - 'scripts/**'
              - 'tests/**'
              - 'package.json'
              - 'tsconfig.json'
              - 'biome.jsonc'
      - name: Lint
        if: steps.changes.outputs.code == 'true'
        run: bunx biome ci . --reporter=github
      # ... remaining steps with same condition
```

Alternatively, for maximum simplicity: **skip path filtering entirely**. The CI runs in ~30-60 seconds. The complexity of path filtering + branch protection workarounds may not be worth it for a small project.

### Anti-Patterns to Avoid

- **`paths-ignore` at workflow level with required checks:** Causes PRs with only doc changes to be permanently blocked from merging.
- **Using `ultracite check` in CI instead of `biome ci`:** Misses GitHub annotation integration; `biome ci --reporter=github` produces inline annotations directly.
- **Separate jobs for lint/typecheck/test:** Adds container startup overhead (~20-30s per job) with no benefit for a small sequential pipeline.
- **Caching `node_modules` with Bun:** Bun install is faster than GitHub Actions cache restore; cache the global store only if at all.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage PR comments | Custom `gh pr comment` script | `zgosalvez/github-actions-report-lcov@v4` | Handles comment updating, permissions, formatting, only-changed-files display |
| Dynamic badges | Custom badge generation | `Schneegans/dynamic-badges-action@v1.7.0` | Handles Gist API, shields.io endpoint format, color ranges |
| Path filtering with required checks | Custom bash diff logic | `dorny/paths-filter@v3` | Handles all edge cases, works with required checks pattern |
| Branch protection setup | Manual GitHub UI | `gh api` script | Reproducible, documented, version-controlled |
| Problem matchers for tsc | Regex in bash | `.github/problem-matchers/tsc.json` | Standard approach, tested pattern from setup-node |

**Key insight:** GitHub Actions has mature marketplace actions for CI reporting tasks. The cost of maintaining custom scripts exceeds the flexibility benefit for a solo project.

## Common Pitfalls

### Pitfall 1: paths-ignore + Required Status Checks = Deadlock

**What goes wrong:** PRs that only change `.md` or `.planning/` files can never merge because the required CI check stays in "Pending" state forever.
**Why it happens:** When `paths-ignore` skips the entire workflow, no status check is reported. Branch protection requires the check to pass, but "not reported" != "passed."
**How to avoid:** Either (a) don't use path filtering at all, or (b) use `dorny/paths-filter@v3` at the step level so the workflow always runs and reports success.
**Warning signs:** PRs with only documentation changes stuck in "Waiting for status to be reported."
**Confidence:** HIGH -- well-documented GitHub limitation with no official fix (In Backlog since 2024).

### Pitfall 2: Draft PR Exclusion Requires Multiple Event Types

**What goes wrong:** Using only `types: [ready_for_review]` means CI doesn't run on code pushes to an already-ready PR.
**Why it happens:** `ready_for_review` only fires when transitioning from draft to ready, not on subsequent `synchronize` (push) events.
**How to avoid:** Use `types: [opened, synchronize, reopened, ready_for_review]` combined with `if: github.event.pull_request.draft == false`.
**Warning signs:** CI runs once when PR is marked ready but not on subsequent pushes.
**Confidence:** HIGH -- documented in GitHub Actions workflow syntax.

### Pitfall 3: biome ci Annotations Require --reporter=github

**What goes wrong:** Running `biome ci .` alone produces console output but no inline annotations on PR files.
**Why it happens:** Biome's default reporter outputs to console. The `--reporter=github` flag formats output as `::error` / `::warning` commands that GitHub Actions interprets.
**How to avoid:** Always use `bunx biome ci . --reporter=github` in CI.
**Warning signs:** Lint errors appear in logs but not as inline annotations on changed files.
**Confidence:** HIGH -- verified in Biome official CI documentation and issue #3148 (resolved).

### Pitfall 4: tsc Annotations Need Problem Matcher (Not Available via setup-bun)

**What goes wrong:** TypeScript errors appear in logs but not as inline annotations.
**Why it happens:** `actions/setup-node` registers tsc problem matchers automatically, but `oven-sh/setup-bun` does not.
**How to avoid:** Create `.github/problem-matchers/tsc.json` and register it with `echo "::add-matcher::.github/problem-matchers/tsc.json"` before running tsc.
**Warning signs:** Lint errors get annotations but typecheck errors do not.
**Confidence:** MEDIUM -- based on analysis of setup-node vs setup-bun behavior; setup-bun README does not mention problem matchers.

### Pitfall 5: bun.lock Is Gitignored -- Cache Key Must Use package.json

**What goes wrong:** Cache key based on `hashFiles('**/bun.lock')` returns empty hash because `bun.lock` is in `.gitignore` and not committed.
**Why it happens:** This project gitignores `bun.lock` (confirmed in `.gitignore`).
**How to avoid:** Use `hashFiles('**/package.json')` as cache key instead, or skip caching entirely (Bun install is fast enough).
**Warning signs:** Cache never hits, every run does fresh install (which is fine but defeats the purpose of caching).
**Confidence:** HIGH -- verified by examining `.gitignore` in the repository.

### Pitfall 6: Coverage Badge Requires a Gist + Personal Access Token

**What goes wrong:** Coverage badge setup fails because no Gist exists or token lacks `gist` scope.
**Why it happens:** `Schneegans/dynamic-badges-action` stores badge JSON in a GitHub Gist, which requires a PAT with `gist` scope stored as a repository secret.
**How to avoid:** Document the one-time setup: create Gist, create PAT, add secret.
**Warning signs:** Badge action fails with authentication error.
**Confidence:** HIGH -- documented in dynamic-badges-action README.

## Code Examples

### Complete CI Workflow

```yaml
# Source: Compiled from official docs for setup-bun, biome, and GitHub Actions
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false || github.event_name == 'push'
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Lint
        run: bunx biome ci . --reporter=github

      - name: Typecheck
        run: |
          echo "::add-matcher::.github/problem-matchers/tsc.json"
          bun run typecheck

      - name: Test with coverage
        run: bun test --coverage

      - name: Check coverage thresholds
        run: bun run scripts/check-coverage.ts

      - name: Report coverage on PR
        if: github.event_name == 'pull_request'
        uses: zgosalvez/github-actions-report-lcov@v4
        with:
          coverage-files: coverage/lcov.info
          minimum-coverage: 80
          github-token: ${{ secrets.GITHUB_TOKEN }}
          update-comment: true

      - name: Extract coverage percentage
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        id: coverage
        run: |
          # Parse overall line coverage from lcov.info
          LF=$(grep -c "^LF:" coverage/lcov.info || echo 0)
          LH=$(grep -c "^LH:" coverage/lcov.info || echo 0)
          # Sum all lines
          TOTAL_LF=$(awk '/^LF:/{s+=$0+0}END{print s+0}' FS=: coverage/lcov.info)
          TOTAL_LH=$(awk '/^LH:/{s+=$0+0}END{print s+0}' FS=: coverage/lcov.info)
          if [ "$TOTAL_LF" -gt 0 ]; then
            COVERAGE=$(awk "BEGIN{printf \"%.1f\", ($TOTAL_LH/$TOTAL_LF)*100}")
          else
            COVERAGE="0.0"
          fi
          echo "percentage=$COVERAGE" >> $GITHUB_OUTPUT

      - name: Update coverage badge
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: schneegans/dynamic-badges-action@v1.7.0
        with:
          auth: ${{ secrets.GIST_SECRET }}
          gistID: <GIST_ID>
          filename: coverage.json
          label: Coverage
          message: ${{ steps.coverage.outputs.percentage }}%
          valColorRange: ${{ steps.coverage.outputs.percentage }}
          maxColorRange: 90
          minColorRange: 50
```

### TypeScript Problem Matcher

```json
// .github/problem-matchers/tsc.json
// Source: actions/setup-node (commit 46071b5, fixed line/column parsing)
{
  "problemMatcher": [
    {
      "owner": "tsc",
      "pattern": [
        {
          "regexp": "^([^\\s].*)[\\(:](\\d+)[,:](\\d+)(?:\\):\\s+|\\s+-\\s+)(error|warning|info)\\s+TS(\\d+)\\s*:\\s*(.*)$",
          "file": 1,
          "line": 2,
          "column": 3,
          "severity": 4,
          "code": 5,
          "message": 6
        }
      ]
    }
  ]
}
```

### Branch Protection Script

```bash
#!/usr/bin/env bash
# scripts/setup-branch-protection.sh
# Source: GitHub REST API docs for protected branches
set -euo pipefail

OWNER="syx-labs"
REPO="passive-docs-index"
BRANCH="main"

echo "Setting up branch protection for $OWNER/$REPO ($BRANCH)..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$OWNER/$REPO/branches/$BRANCH/protection" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=CI' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews=null' \
  -f 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'

echo "Branch protection configured successfully."
echo "  - Required status check: CI"
echo "  - Enforce admins: true"
echo "  - No PR review required (solo project)"
echo "  - Force push: blocked"
echo "  - Deletions: blocked"
```

### Shields.io Badge Markdown

```markdown
<!-- CI status badge -->
[![CI](https://img.shields.io/github/actions/workflow/status/syx-labs/passive-docs-index/ci.yml?branch=main&style=flat&label=CI)](https://github.com/syx-labs/passive-docs-index/actions/workflows/ci.yml)

<!-- Coverage badge (requires Gist setup) -->
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<USERNAME>/<GIST_ID>/raw/coverage.json)](https://github.com/syx-labs/passive-docs-index/actions/workflows/ci.yml)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `bun.lockb` (binary) | `bun.lock` (text) | Bun 1.2.0 | Text lockfile is diffable but this project gitignores it |
| `biome check` in CI | `biome ci` with `--reporter=github` | Biome 1.5+ | Purpose-built CI command with annotation support |
| `oven-sh/setup-bun@v1` | `oven-sh/setup-bun@v2` | 2024 | v2 is current, verified on GitHub Marketplace |
| Manual badge JSON | `Schneegans/dynamic-badges-action@v1.7.0` | 2023 | Simplified Gist-based badge updates |

**Deprecated/outdated:**
- `biome ci` without `--reporter=github`: Works but misses the primary CI benefit (annotations)
- `biome ci --reporter=github --colors=off`: Was needed as workaround for issue #3148; no longer needed after PR #3281 merged (colors auto-disabled for github reporter)

## Open Questions

1. **Should bun.lock be committed for CI reproducibility?**
   - What we know: `bun.lock` is currently gitignored. CI runs `bun install` without `--frozen-lockfile`.
   - What's unclear: Whether the project owner intentionally gitignores it or if it's an oversight.
   - Recommendation: For CI reproducibility, committing `bun.lock` would be ideal. But since the user didn't raise this, proceed with `bun install` (no frozen lockfile) and use `package.json` hash for cache key.

2. **Should path filtering be implemented or skipped?**
   - What we know: User wants path filtering. But `paths-ignore` breaks required checks.
   - What's unclear: Whether the added complexity of `dorny/paths-filter` is worth it for a small project.
   - Recommendation: Use `dorny/paths-filter@v3` at step level to honor the user's decision without breaking branch protection. Document the tradeoff.

3. **Gist setup for coverage badge**
   - What we know: Requires a manual one-time setup (create Gist, create PAT with gist scope, add GIST_SECRET to repo secrets).
   - What's unclear: Whether the project owner already has a suitable PAT.
   - Recommendation: Include setup instructions as part of the plan. The badge step can be added but will need manual secret configuration.

## Sources

### Primary (HIGH confidence)
- [Biome CI Integration](https://biomejs.dev/recipes/continuous-integration/) - `biome ci` usage, GitHub annotations, reporter flag
- [oven-sh/setup-bun README](https://github.com/oven-sh/setup-bun) - All inputs, caching, version options
- [GitHub REST API: Branch Protection](https://docs.github.com/en/rest/branches/branch-protection) - PUT endpoint, required_status_checks, enforcement options
- [zgosalvez/github-actions-report-lcov](https://github.com/zgosalvez/github-actions-report-lcov) - Inputs, permissions, PR commenting
- [Schneegans/dynamic-badges-action](https://github.com/Schneegans/dynamic-badges-action) - Gist-based badges, all inputs, setup process
- [Shields.io GitHub Actions badge](https://shields.io/badges/git-hub-actions-workflow-status) - URL format, parameters
- [GitHub Troubleshooting Required Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks) - paths-ignore limitation

### Secondary (MEDIUM confidence)
- [Biome issue #3148](https://github.com/biomejs/biome/issues/3148) - GitHub reporter annotations fix (resolved)
- [actions/setup-node commit 46071b5](https://github.com/actions/setup-node/commit/46071b5c7a2e0c34e49c3cb8a0e792e86e18d5ea) - tsc problem matcher regex
- [GitHub Community Discussion #25722](https://github.com/orgs/community/discussions/25722) - Draft PR exclusion patterns
- [GitHub Community Discussion #44490](https://github.com/orgs/community/discussions/44490) - paths-ignore + required checks deadlock
- [Bun CI/CD Guide](https://bun.sh/guides/install/cicd) - Official setup-bun usage
- [Bun Discussion #18752](https://github.com/oven-sh/bun/discussions/18752) - Cache paths recommendation

### Tertiary (LOW confidence)
- None -- all findings verified with at least two sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools verified via official documentation
- Architecture: HIGH -- Patterns verified via GitHub docs and community best practices
- Pitfalls: HIGH -- All pitfalls verified with official sources or confirmed issues
- Code examples: MEDIUM -- Compiled from multiple official sources, not tested end-to-end

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (30 days -- GitHub Actions and Bun ecosystem are stable)
