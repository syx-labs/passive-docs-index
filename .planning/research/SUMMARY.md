# Project Research Summary

**Project:** Passive Docs Index (PDI)
**Domain:** CLI developer tool / AI documentation indexing
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

PDI is evolving from a working prototype (v0.2.0) to a production-grade npm package (v1.0). The research reveals that PDI occupies a unique position in the AI documentation tooling space: it creates passive, always-in-context documentation indexes for Claude Code, achieving 100% trigger rates versus 44% for skills-based approaches. This competitive moat is built on the CLAUDE.md passive context mechanism, but realizing v1.0 requires addressing technical debt, establishing testing infrastructure, and integrating deeply with Claude Code's skills/hooks system.

The recommended approach follows a strict dependency-based build order: testing infrastructure first (enables all other work safely), CI/CD second (validates publishable artifacts), Claude Code integration third (delivers differentiating value), and VS Code extension last (requires stable core library). The current codebase has significant testability issues (silent exception swallowing, tightly coupled I/O, missing config validation) that must be refactored before adding tests. The Node.js 18+ compatibility target eliminates Vitest as an option (requires Node 20+), making Bun's built-in test runner the only viable choice.

The key risk is publishing a broken first npm package — missing shebangs, missing type declarations, broken ESM exports — which cannot be fixed retroactively due to npm's immutability rules. Prevention requires rigorous package validation (npm pack + tarball testing) in CI before any publish workflow. Secondary risks include Claude Code skills that over-trigger or under-trigger, hooks that block Claude mid-plan, and VS Code extension code duplication (must consume core library, not reimplement).

## Key Findings

### Recommended Stack

The v0.3.0 milestone extends PDI's existing stack (Commander.js 13, Chalk 5, Context7 SDK, Bun, TypeScript 5.7) with production tooling. The stack choices are heavily constrained by Node.js 18+ compatibility and the project's single-package structure.

**Core technologies:**
- **Bun Test (built-in)**: Unit + integration testing — already configured, Jest-compatible API, zero deps, fastest execution. Vitest 4+ requires Node 20+ (via Vite dependency), breaking PDI's compatibility target.
- **GitHub Actions**: CI/CD orchestration — project already on GitHub, free for open source, requires `oven-sh/setup-bun@v2` for Bun runtime + `actions/setup-node@v4` for npm publish with provenance.
- **Changesets**: Version management + changelog generation — works with single packages, generates CHANGELOG.md, integrates with GitHub Actions for automated releases.
- **Husky 9 + lint-staged**: Git hooks — 2kB, minimal overhead, ecosystem standard (7M+ weekly downloads), superior to Lefthook for single-language projects.
- **Claude Code Skills/Hooks**: Zero-dependency integration — file-based SKILL.md with YAML frontmatter, hooks in `.claude/settings.json`, follows Agent Skills open standard.
- **VS Code Extension (separate package)**: `@vscode/vsce` for packaging, esbuild for bundling — requires Node 20+ for build toolchain (not runtime), should be separate package consuming `passive-docs-index` as dependency.

**Critical constraint:** `bun publish --provenance` is not implemented (GitHub issue #15601 still open). Must use `npm publish --provenance` in CI while using Bun for all other operations (install, test, build).

### Expected Features

**Must have (table stakes):**
- Test suite with 80%+ coverage — credibility signal, enables safe contributions
- CI pipeline with GitHub Actions — automated validation, visible status badges
- npm provenance + trusted publishing — supply chain security, ecosystem expectation post-2025
- Proper package configuration — `engines`, `bin`, `files`, `exports`, types all correct
- CHANGELOG / release notes — users need to know what changed
- Error handling + helpful messages — CLI tools that crash with stack traces lose users
- English documentation — Portuguese README blocks global adoption

**Should have (competitive differentiators):**
- Claude Code skills (`/pdi-analyze`, `/pdi-sync`, `/pdi-status`, `/pdi-add`) — massive DX improvement, PDI feels "native" to Claude Code
- Claude Code hooks integration — auto-sync on install, inject context on SessionStart, truly passive operation
- Claude Code plugin packaging — single `/plugin install pdi` bundles skills + hooks + MCP config
- Custom template system — user-defined frameworks beyond built-in 10, community-contributed templates
- VS Code extension — TreeView, CodeLens, command palette, visual alternative to CLI

**Defer (v2+):**
- Monorepo support — complex, needs real-world usage patterns first
- Automated freshness checking — valuable but not blocking adoption
- llms.txt integration — spec not yet standardized, evaluate post-v1.0
- Real-time MCP server — massive scope, Context7 already provides this
- Web dashboard — listed in README but huge scope for CLI tool, VS Code extension better alternative

### Architecture Approach

PDI's existing architecture is a clean layered design: CLI Layer (Commander.js) → Command Layer (9 commands) → Service Layer (10 modules) → Data Layer (.claude-docs/). The service layer uses stateless functions with explicit arguments, which is ideal for testing but requires refactoring I/O boundaries.

**Major components:**
1. **Testing Infrastructure** — New `tests/` directory with fixtures, unit tests (pure functions), integration tests (commands with mocked I/O), and helpers for fs/Context7 mocking. Bun Test's `mock.module()` handles ESM mocking.
2. **CI/CD Pipeline** — GitHub Actions workflows for test/lint/typecheck on push/PR (`ci.yml`) and npm publish on release (`publish.yml`). Must validate package tarball before publish.
3. **Claude Code Integration** — Skills in `.claude/skills/pdi-*/SKILL.md` (thin wrappers invoking CLI), hooks in `.claude/settings.json` (PostToolUse for install detection, SessionStart for context injection). Zero code changes to core.
4. **VS Code Extension (future)** — Separate package in `packages/vscode/`, imports from `@pdi/core`, handles VS Code API integration only. Requires core library extraction and monorepo migration.

**Key architectural decisions:**
- Keep single-package structure until VS Code extension development (defer monorepo)
- Extract pure logic from I/O for testability (separate index generation from file writes)
- VS Code extension consumes programmatic API, does not shell out to CLI
- Skills invoke CLI via Bash tool, do not duplicate logic
- Use PostToolUse/Stop hooks, not PreToolUse (avoid blocking Claude mid-plan)

### Critical Pitfalls

1. **Testing an untested codebase by starting with the wrong layer** — Starting with E2E/command tests hits walls due to tight I/O coupling. Commands mix logic with file operations, Context7 API calls, interactive prompts. Prevention: Refactor for testability FIRST (extract pure logic), start with unit tests on pure functions, add integration tests only after. Warning sign: test files longer than source files.

2. **Publishing a broken npm package on first release** — Current build uses `bun build` which does NOT emit type declarations or shebangs. The `files` field may exclude needed files. npm does not allow re-publishing same version; after 24 hours, broken versions cannot be unpublished. Prevention: Add `tsc --emitDeclarationOnly`, prepend shebang to dist/cli.js, validate with `npm pack` + tarball install test in CI, use `attw` to check type exports. Detection: run `npm pack --dry-run` and verify dist/, .d.ts, templates/ present.

3. **Building VS Code extension as separate codebase** — Temptation to start fresh with extension-specific code leads to duplicated config parsing, status logic, template handling. Every bug fix requires changes in two places. Prevention: Extract `@pdi/core` library that both CLI and extension consume. Extension handles VS Code API only. Detection: if extension's package.json doesn't list `passive-docs-index` as dependency, architecture is wrong.

4. **Claude Code skills that over-trigger or under-trigger** — Vague descriptions ("helps with documentation") match too broadly and consume the 15,000 character context budget. Overly specific descriptions never match natural language. Prevention: Write descriptions matching INTENT ("Analyze project documentation index health... Use when auditing documentation coverage or after adding dependencies"), use `disable-model-invocation: true` for task skills, test with `/context` to verify loading.

5. **Hooks that block mid-plan instead of validating at boundaries** — PreToolUse hooks blocking every file write confuse Claude mid-plan, causing retry loops or abandoned plans. Prevention: Use PostToolUse or Stop hooks for validation, PreToolUse only for genuinely dangerous operations. For PDI: PostToolUse on Bash to detect installs, Stop to check CLAUDE.md freshness. Never block writes waiting for docs update.

## Implications for Roadmap

Based on research, suggested phase structure follows strict dependencies:

### Phase 1: Testing Infrastructure
**Rationale:** Foundation for all other work. Current codebase has untested code with silent exception swallowing, type assertion issues, and tight I/O coupling (verified in CONCERNS.md). Cannot safely add features or refactor without tests. Bun Test is already configured and Node 18+ compatible (Vitest is not).

**Delivers:**
- Test directory structure with fixtures and helpers
- Unit tests for pure functions (config, templates, index-parser, fs-utils)
- Integration tests for commands (mocked I/O)
- Testability refactoring (separate pure logic from I/O)
- Config validation with Zod (addresses TD-1 from PITFALLS.md)
- Error handling conventions (addresses TD-3)

**Addresses:**
- T1 (Test suite) from FEATURES.md
- T6 (Error handling) from FEATURES.md

**Avoids:**
- Pitfall 1 (testing wrong layer) — refactor for testability first
- TD-1 (config validation deferred) — add Zod validation immediately
- TD-3 (inconsistent error handling) — establish conventions before tests

### Phase 2: CI/CD + npm Publishing
**Rationale:** Validates publishable artifacts before any public release. Prevents Pitfall 2 (broken first publish). Must include package validation (npm pack, tarball testing, shebang verification, type declaration checks). Uses Bun for test/build, Node.js/npm for publish (provenance support).

**Delivers:**
- GitHub Actions workflow for test/lint/typecheck on push/PR
- GitHub Actions workflow for npm publish on release
- Package validation: npm pack + tarball install test + attw type checking
- Shebang addition to dist/cli.js
- Type declaration emission via `tsc --emitDeclarationOnly`
- Changesets integration for version management
- npm provenance via GitHub OIDC trusted publishing

**Uses:**
- GitHub Actions (ci.yml, publish.yml)
- oven-sh/setup-bun@v2, actions/setup-node@v4
- Changesets for versioning
- npm publish --provenance (not bun publish)

**Addresses:**
- T2 (CI pipeline) from FEATURES.md
- T3 (npm provenance) from FEATURES.md
- T4 (package configuration) from FEATURES.md
- T5 (CHANGELOG) from FEATURES.md

**Avoids:**
- Pitfall 2 (broken first publish) — comprehensive package validation in CI
- IG-2 (missing shebang/types) — explicit build steps for both
- LD-2 (CI without package validation) — tarball install test required

### Phase 3: Claude Code Skills + Hooks
**Rationale:** Delivers PDI's key differentiator (native Claude Code integration) with minimal code changes (file-based configuration only). Skills provide `/pdi-analyze`, `/pdi-sync`, `/pdi-status`, `/pdi-add` commands. Hooks enable passive automation (auto-sync after install, context injection). Low risk since it's additive (no changes to core code).

**Delivers:**
- `.claude/skills/pdi-add/SKILL.md`
- `.claude/skills/pdi-sync/SKILL.md`
- `.claude/skills/pdi-status/SKILL.md`
- `.claude/skills/pdi-analyze/SKILL.md` (auto-triggered)
- `.claude/settings.json` with PostToolUse hook (detect npm/bun install)
- `.claude/settings.json` with SessionStart hook (inject index status)
- Skill descriptions tuned to avoid over/under-triggering

**Addresses:**
- D1 (Claude Code skills) from FEATURES.md
- D2 (Claude Code hooks) from FEATURES.md
- T7 (Postinstall hook) from FEATURES.md

**Avoids:**
- Pitfall 4 (skill trigger calibration) — use intent-based descriptions, test with `/context`
- Pitfall 5 (mid-plan blocking) — PostToolUse and Stop hooks only, no PreToolUse
- IG-4 (environment assumptions) — hooks check for PDI availability, graceful no-op if missing
- LD-6 (context budget blown) — keep skills under 500 lines each, verify with `/context`

### Phase 4: Claude Code Plugin Packaging
**Rationale:** Bundles skills + hooks + MCP config into single installable plugin. Depends on stable skills/hooks from Phase 3. Enables `/plugin install pdi` distribution. Minimal additional work since skills/hooks already exist.

**Delivers:**
- `pdi-plugin/.claude-plugin/plugin.json` manifest
- Skills copied to `pdi-plugin/skills/`
- Hooks configuration in `pdi-plugin/hooks/hooks.json`
- `.mcp.json` for Context7 fallback configuration
- Plugin published to Claude Code plugin registry

**Addresses:**
- D3 (Plugin packaging) from FEATURES.md

### Phase 5: Git Hooks (Husky + lint-staged)
**Rationale:** Automated quality checks at commit time. Simple setup (npx husky init), minimal overhead (2kB, ~1ms), ecosystem standard. Runs Biome lint + typecheck + tests on pre-commit.

**Delivers:**
- Husky 9 configuration in `.husky/`
- lint-staged configuration in package.json
- Pre-commit hook: lint-staged (Biome format only on changed files)
- Pre-commit hook: typecheck + tests (bail fast on failure)

**Uses:**
- Husky 9.1.7
- lint-staged 16.2.7

**Avoids:**
- SM-2 (hooks executing untrusted code) — ship scripts with absolute paths, keep under 50 lines

### Phase 6: Custom Template System
**Rationale:** Extends PDI's value beyond 10 built-in frameworks. Enables community-contributed templates. Requires design iteration for template format (YAML vs TypeScript), resolution chain (user > project > npm > built-in), and validation schema.

**Delivers:**
- `src/lib/template-registry.ts` (unified registry)
- `src/lib/template-loader.ts` (load from .pdi/templates/ or npm)
- Template resolution chain: ~/.pdi/templates/ → .pdi/templates/ → @pdi/template-{name} → built-in
- JSON Schema for template validation
- Documentation for external template authors

**Addresses:**
- D4 (Custom templates) from FEATURES.md

**Avoids:**
- A5 (global template registry) — support local files and npm packages, not hosted registry

### Phase 7: VS Code Extension + Monorepo Migration
**Rationale:** High complexity, requires monorepo structure. Depends on stable, tested core library from Phases 1-2. Separate package consuming `@pdi/core` via programmatic API (not subprocess CLI invocation). Only phase requiring architectural restructuring.

**Delivers:**
- Monorepo structure: packages/core, packages/cli, packages/vscode
- Core library extraction: @pdi/core with config, context7-client, templates, fs-utils, index-parser
- VS Code extension: TreeView (framework list), commands (sync/add/status), status bar, CodeLens
- Extension bundled with esbuild (handles ESM → CJS conversion)
- VSIX packaging with @vscode/vsce

**Uses:**
- VS Code extension API (TreeView, commands, status bar, CodeLens)
- esbuild for extension bundling
- @vscode/vsce for packaging (Node 20+ required for build toolchain only)
- npm workspaces for monorepo (not Turborepo — overhead unjustified for 3 packages)

**Addresses:**
- D6 (VS Code extension) from FEATURES.md

**Avoids:**
- Pitfall 3 (separate codebase) — extension imports @pdi/core, no logic duplication
- Anti-Pattern 2 (shelling out) — direct programmatic API import
- Anti-Pattern 4 (premature monorepo) — only migrate when VS Code extension actually built
- IG-3 (ESM/CJS conflict) — esbuild handles conversion
- LD-3 (dev host only) — build VSIX, test in clean VS Code

### Phase 8: Documentation Translation + Open Source Polish
**Rationale:** Final quality gate before v1.0. Translate Portuguese README to English (table stakes for global npm package). Add contributor guardrails (CONTRIBUTING.md, issue templates, PR template).

**Delivers:**
- English README.md
- README.pt-BR.md (original Portuguese)
- CONTRIBUTING.md with development setup
- GitHub issue templates
- Pull request template
- "Good first issue" labels
- Code of conduct

**Addresses:**
- T8 (English documentation) from FEATURES.md
- LD-5 (contributor guardrails) from PITFALLS.md

### Phase Ordering Rationale

1. **Testing first** — Every subsequent phase depends on tests existing. Refactoring for testability catches the silent exception swallowing and type assertion issues identified in CONCERNS.md. Without tests, changes risk regressions.

2. **CI/CD second** — Automates the test gate and validates publishable artifacts. Must catch npm package issues (shebang, types, files) before any release.

3. **Skills/Hooks third** — Low-risk additions (new files only, no code changes) that deliver PDI's key differentiator. Can be iterated quickly based on user feedback.

4. **Plugin fourth** — Simple packaging of existing skills/hooks. Minimal additional work.

5. **Git hooks fifth** — Developer workflow improvement. Independent of other phases.

6. **Custom templates sixth** — Extends value but not blocking adoption. Benefits from test coverage established in Phase 1.

7. **VS Code extension seventh** — Highest complexity, requires monorepo migration and core extraction. Depends on stable, tested foundation.

8. **Documentation last** — Final polish before v1.0 release.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 7 (VS Code Extension)** — VS Code API patterns (TreeView data providers, webview security, activation events). Current research is architectural; implementation details need deeper dive.
- **Phase 6 (Custom Templates)** — Template format design (YAML vs TypeScript), validation schema, npm package conventions for templates. Requires design iteration.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Testing)** — Bun Test is well-documented, mocking patterns are standard
- **Phase 2 (CI/CD)** — GitHub Actions + npm publish is thoroughly documented
- **Phase 3 (Skills/Hooks)** — Claude Code official docs provide complete specification
- **Phase 4 (Plugin)** — Plugin manifest format is documented
- **Phase 5 (Git Hooks)** — Husky setup is standard, lint-staged is well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Bun Test requirement verified via Context7 (Vitest Node 20+ incompatibility), GitHub Actions and npm provenance verified via official docs, Claude Code skills/hooks verified via code.claude.com official documentation |
| Features | HIGH | Table stakes identified from npm ecosystem norms, differentiators based on PDI's unique value prop (passive context), anti-features based on scope creep patterns |
| Architecture | HIGH | Existing codebase analyzed, testability issues identified in CONCERNS.md, VS Code extension patterns verified via Context7 microsoft/vscode-docs, monorepo defer decision well-justified |
| Pitfalls | HIGH | Critical pitfalls verified against current codebase issues (CONCERNS.md), npm publishing pitfalls verified via official docs, Claude Code trigger/blocking issues verified via official hooks/skills documentation |

**Overall confidence:** HIGH

### Gaps to Address

- **Template format design** — YAML vs TypeScript for custom templates needs design iteration. Current templates are TypeScript objects. Consider JSON Schema for validation and interoperability.

- **Monorepo migration mechanics** — The VS Code extension phase requires extracting `@pdi/core` from `src/lib/`. The specific refactoring steps (package.json updates, import path changes, type re-exports) need detailed planning during Phase 7 requirements definition.

- **VS Code extension activation events** — Need to determine optimal activation pattern (onStartupFinished vs onCommand vs workspace contains .claude-docs). Research during Phase 7 planning.

- **npm publish automation details** — Changesets GitHub Action (`changesets/action`) creates "Version Packages" PR automatically. The merge-triggers-publish workflow needs validation in a test environment before production use.

- **Context7 SDK version pinning strategy** — SDK is pre-1.0 (0.3.0), allowing breaking changes in minor versions. Need monitoring strategy for SDK updates and decision criteria for when to upgrade.

## Sources

### Primary (HIGH confidence)
- Context7 `/vitest-dev/vitest` — Vitest Node 20+ requirement confirmed
- Context7 `/websites/github_en_actions` — GitHub Actions workflow patterns
- Context7 `/changesets/changesets` — Single-package versioning workflow
- Context7 `/websites/typicode_github_io_husky` — Husky v9 configuration
- Context7 `/microsoft/vscode-docs` — VS Code extension API patterns
- Context7 `/oven-sh/bun` — Bun Test runner mocking capabilities
- Context7 `/websites/turborepo` — Monorepo patterns (deferred)
- Official Claude Code Hooks: https://code.claude.com/docs/en/hooks-guide — Event schema, matchers, I/O protocol
- Official Claude Code Skills: https://code.claude.com/docs/en/skills — SKILL.md format, frontmatter specification
- Official Claude Code Plugins: https://code.claude.com/docs/en/plugins — Plugin manifest, distribution
- npm Provenance: https://docs.npmjs.com/generating-provenance-statements/ — Trusted publishing specification
- PDI Codebase Analysis: `.planning/codebase/CONCERNS.md`, `ARCHITECTURE.md`, `TESTING.md`, `STACK.md`

### Secondary (MEDIUM confidence)
- Bun GitHub issue #15601 — `bun publish --provenance` not implemented
- lint-staged v16.2.7 npm registry listing
- @vscode/vsce Node 20 requirement from npm registry
- Vitest 4.0 release notes — Node version requirements
- npm Trusted Publishing blog posts — Practical OIDC setup guides
- Lefthook vs Husky comparisons — Adoption metrics, use case fit

### Tertiary (LOW confidence)
- llms.txt specification — Emerging spec, not yet standardized (defer to v2+)
- Context7 alternatives landscape — Competitive analysis (PDI's unique position verified but alternative counts unverified)
- VS Code extension development best practices — General guidance, not PDI-specific (verify during Phase 7)

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*
