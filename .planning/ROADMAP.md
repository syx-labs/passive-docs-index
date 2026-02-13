# Roadmap: Passive Docs Index (PDI) v1.0

## Overview

PDI evolves from a working prototype (v0.2.0) to a production-grade npm package (v1.0) across 10 phases. The build order follows strict dependencies: testing infrastructure first (enables safe changes), CI/CD and publishing second (validates distributable artifacts), error handling and automation third (production hardening), then value-add features (Claude Code integration, custom templates, monorepo support, VS Code extension), and documentation polish last. Every phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Testing Infrastructure** - Unit and integration test suite with testability refactoring
- [x] **Phase 2: CI/CD Pipeline** - GitHub Actions workflows for automated validation on every push
- [x] **Phase 3: Publishing & Distribution** - npm package configuration, provenance, and release automation
- [ ] **Phase 4: Error Handling & Validation** - Structured error handling and Zod-based config validation
- [ ] **Phase 5: Automation** - Postinstall hooks, freshness checking, and CI-friendly --check flags
- [ ] **Phase 6: Claude Code Skills & Hooks** - Skills for analyze/generate/sync and PostToolUse/SessionStart hooks
- [ ] **Phase 7: Claude Code Plugin** - Bundled plugin packaging for single-command installation
- [ ] **Phase 8: Custom Templates** - User-defined template system with registry and scaffolding
- [ ] **Phase 9: Monorepo Support & VS Code Extension** - Workspace detection, cross-package sync, and VS Code TreeView/commands
- [ ] **Phase 10: Documentation & Polish** - English README, CONTRIBUTING.md, and API documentation

## Phase Details

### Phase 1: Testing Infrastructure
**Goal**: Developers can run a comprehensive test suite that validates core logic and CLI commands before making changes
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Running `bun test` executes unit tests for config, templates, index-parser, and fs-utils modules with all tests passing
  2. Integration tests exercise each CLI command (init, add, sync, status, clean, update) against mocked I/O without hitting real filesystem or network
  3. Test coverage report shows 80%+ coverage on `src/lib/` directory
  4. External I/O (filesystem, Context7 HTTP, MCP CLI) is mocked in every test -- no test depends on network or disk state
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md -- Test infrastructure setup and testability refactoring
- [x] 01-02-PLAN.md -- Unit tests for core data modules (config, templates, index-parser, fs-utils)
- [x] 01-03-PLAN.md -- Unit tests for I/O modules (context7-client, mcp-client, context7, index-utils)
- [x] 01-04-PLAN.md -- Integration tests for CLI commands and coverage validation

### Phase 2: CI/CD Pipeline
**Goal**: Every push and PR is automatically validated by lint, typecheck, and test checks in GitHub Actions
**Depends on**: Phase 1
**Requirements**: CICD-01
**Success Criteria** (what must be TRUE):
  1. Opening a PR triggers a GitHub Actions workflow that runs Biome lint, tsc typecheck, and bun test
  2. PRs with lint errors, type errors, or failing tests cannot merge (branch protection enforced)
  3. CI status badge in README reflects current build health
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- CI workflow, tsc problem matcher, and branch protection script
- [x] 02-02-PLAN.md -- README badges and end-to-end CI verification

### Phase 3: Publishing & Distribution
**Goal**: PDI is installable from npm with `npx pdi` working out of the box, with provenance and changelogs
**Depends on**: Phase 2
**Requirements**: CICD-02, CICD-03, CICD-04, DIST-01, DIST-02, DIST-03, DIST-04
**Success Criteria** (what must be TRUE):
  1. Running `npx pdi --help` in a clean environment shows the CLI help without errors (shebang, bin, dist/ all correct)
  2. npm publish workflow triggers on GitHub release with OIDC provenance -- provenance badge visible on npmjs.com
  3. Package includes type declarations (.d.ts) that IDEs can consume for the programmatic API
  4. CHANGELOG.md is generated via Changesets with release notes for each version
  5. `npm pack --dry-run` output includes dist/ and type declarations -- no missing files
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Package configuration, two-step build (JS + .d.ts), and Changesets initialization
- [x] 03-02-PLAN.md -- Release and publish workflows (changesets/action + npm OIDC provenance)

### Phase 4: Error Handling & Validation
**Goal**: CLI commands fail gracefully with user-friendly messages and config is validated at runtime with Zod
**Depends on**: Phase 1
**Requirements**: ERR-01, ERR-02, ERR-03, ERR-04
**Success Criteria** (what must be TRUE):
  1. Every CLI command catches errors and displays a readable message (no raw stack traces in normal usage)
  2. Context7 failures (network timeout, auth error, rate limit) show a specific message explaining the issue and available fallback
  3. Invalid or corrupted config.json displays what is wrong and how to fix it (e.g., "Expected string for 'version', got number. Run `pdi init` to regenerate")
  4. Config is validated against a Zod schema at load time -- type mismatches are caught before commands execute
**Plans**: TBD

Plans:
- [ ] 04-01: Zod schema and config validation
- [ ] 04-02: CLI error handling conventions

### Phase 5: Automation
**Goal**: PDI detects when docs are stale and can validate doc health in CI pipelines
**Depends on**: Phase 4
**Requirements**: AUTO-01, AUTO-02, AUTO-03
**Success Criteria** (what must be TRUE):
  1. After running `npm install` or `bun install`, a postinstall message suggests running `pdi sync` if PDI is configured in the project
  2. `pdi status` shows which frameworks have version mismatches between installed packages and indexed docs
  3. Running `pdi status --check` exits with non-zero code if docs are stale or missing -- usable as a CI gate
**Plans**: TBD

Plans:
- [ ] 05-01: Postinstall hook, freshness checking, and --check flag

### Phase 6: Claude Code Skills & Hooks
**Goal**: Claude Code users can invoke PDI via slash commands and get automatic sync suggestions after installing packages
**Depends on**: Phase 4
**Requirements**: CLAUDE-01, CLAUDE-02, CLAUDE-03, CLAUDE-04, CLAUDE-05
**Success Criteria** (what must be TRUE):
  1. Typing `/pdi-analyze` in Claude Code triggers project documentation analysis showing doc coverage, stale docs, and suggestions
  2. Typing `/pdi-generate` in Claude Code initiates assisted documentation generation for project patterns
  3. Typing `/pdi-sync` in Claude Code runs interactive sync with framework detection and confirmation
  4. After running `npm install` or `bun install` in Claude Code, a PostToolUse hook suggests running `pdi sync` if new dependencies were added
  5. Starting a Claude Code session in a PDI-configured project injects documentation index status into context via SessionStart hook
**Plans**: TBD

Plans:
- [ ] 06-01: Skills implementation (pdi-analyze, pdi-generate, pdi-sync)
- [ ] 06-02: Hooks implementation (PostToolUse, SessionStart)

### Phase 7: Claude Code Plugin
**Goal**: PDI skills, hooks, and MCP config are installable as a single Claude Code plugin
**Depends on**: Phase 6
**Requirements**: CLAUDE-06
**Success Criteria** (what must be TRUE):
  1. Plugin can be installed in a single step, adding all skills and hooks to the project
  2. After plugin installation, all three skills (/pdi-analyze, /pdi-generate, /pdi-sync) and both hooks (PostToolUse, SessionStart) are active
**Plans**: TBD

Plans:
- [ ] 07-01: Plugin manifest and packaging

### Phase 8: Custom Templates
**Goal**: Users can create, share, and use custom framework templates beyond the built-in 10
**Depends on**: Phase 1
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04
**Success Criteria** (what must be TRUE):
  1. Running `pdi add my-framework` resolves templates from user-local (~/.pdi/templates/), then project (.pdi/templates/), then npm (@pdi/template-*), then built-in -- first match wins
  2. Custom templates use a YAML format with a validatable schema -- `pdi template validate` reports errors in template structure
  3. Running `pdi template create my-framework` scaffolds a template file with correct structure and inline documentation
  4. Template authoring documentation explains format, resolution chain, and how to publish templates to npm
**Plans**: TBD

Plans:
- [ ] 08-01: Template registry and YAML format
- [ ] 08-02: Template scaffolding and documentation

### Phase 9: Monorepo Support & VS Code Extension
**Goal**: PDI works across monorepo workspaces and provides a visual interface in VS Code
**Depends on**: Phase 3, Phase 8
**Requirements**: MONO-01, MONO-02, MONO-03, VSCE-01, VSCE-02, VSCE-03, VSCE-04
**Success Criteria** (what must be TRUE):
  1. In a monorepo with npm/pnpm/bun workspaces, `pdi init` detects workspace packages automatically
  2. Each workspace package maintains its own config and docs scope -- `pdi status` in a package shows only that package's docs
  3. Running `pdi sync` at the monorepo root syncs docs across all workspace packages
  4. VS Code extension shows a TreeView listing indexed frameworks with their health status (up-to-date, stale, missing)
  5. VS Code command palette provides add, sync, and status commands that invoke PDI's programmatic API (not subprocess)
**Plans**: TBD

Plans:
- [ ] 09-01: Monorepo workspace detection and cross-package sync
- [ ] 09-02: Core library extraction for programmatic API
- [ ] 09-03: VS Code extension (TreeView, commands, status bar)

### Phase 10: Documentation & Polish
**Goal**: PDI is ready for global open-source adoption with English docs and contributor guides
**Depends on**: Phase 3
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. README.md is in English and covers installation, usage, all commands, and configuration
  2. README.pt-BR.md preserves the original Portuguese documentation
  3. CONTRIBUTING.md explains development setup, testing, linting, and how to submit PRs
  4. API documentation covers the programmatic exports for use in other tools
**Plans**: TBD

Plans:
- [ ] 10-01: English README and CONTRIBUTING.md
- [ ] 10-02: API documentation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phases 4 and 6 can start after Phase 1 (independent of Phase 2/3). Phase 8 can start after Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Testing Infrastructure | 4/4 | Complete | 2026-02-05 |
| 2. CI/CD Pipeline | 2/2 | Complete | 2026-02-13 |
| 3. Publishing & Distribution | 0/2 | Not started | - |
| 4. Error Handling & Validation | 0/2 | Not started | - |
| 5. Automation | 0/1 | Not started | - |
| 6. Claude Code Skills & Hooks | 0/2 | Not started | - |
| 7. Claude Code Plugin | 0/1 | Not started | - |
| 8. Custom Templates | 0/2 | Not started | - |
| 9. Monorepo Support & VS Code Extension | 0/3 | Not started | - |
| 10. Documentation & Polish | 0/2 | Not started | - |
