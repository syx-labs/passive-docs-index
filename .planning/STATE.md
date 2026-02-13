# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Documentacao de frameworks sempre disponivel no contexto do assistente de IA, sem decisao de busca necessaria
**Current focus:** Phase 6 - Claude Code Skills & Hooks

## Current Position

Phase: 6 of 10 (Claude Code Skills & Hooks)
Plan: 0 of 2 in current phase (not yet planned)
Status: Phase 5 complete. Phase 6 ready for planning.
Last activity: 2026-02-13 -- Phase 5 executed (2 plans, 2 waves) and verified

Progress: [############------] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: ~5m 45s
- Total execution time: ~1.35 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Testing Infrastructure | 4/4 | 26m 51s | 6m 43s |
| 02 CI/CD Pipeline | 2/2 | ~5m | ~2m 30s |
| 03 Publishing & Distribution | 3/3 | ~23m | ~7m 40s |
| 04 Error Handling & Validation | 2/2 | ~10m | ~5m |
| 05 Automation | 2/2 | ~12m | ~6m |

**Recent Trend:**
- Last 4 plans: 04-01 (~5m), 04-02 (~5m), 05-01 (~6m), 05-02 (~6m)
- Trend: Consistent execution with wave-based parallelization

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Bun Test chosen over Vitest (Vitest requires Node 20+, breaking Node 18+ target)
- [Roadmap]: npm publish with provenance via OIDC (bun publish --provenance not implemented)
- [Roadmap]: VS Code extension deferred to Phase 9 (requires stable core + monorepo extraction)
- [Roadmap]: Monorepo migration only when VS Code extension built (avoid premature restructuring)
- [01-01]: IMcpClient created in Task 1 (not Task 2) because mock-mcp.ts depends on it
- [01-01]: spyOn(global, 'fetch') chosen for HTTP mocking (MSW/nock incompatible with Bun)
- [01-01]: Per-module coverage uses exact filename matching
- [01-01]: generate.ts also gets projectRoot for consistency
- [01-02]: Fixed mock-fs.ts existsSync to detect directories by prefix
- [01-04]: check-coverage.ts path matching fixed (interfaces/mcp-client.ts was grouped with mcp-client.ts)
- [01-04]: bunfig.toml coverage ignore extended to src/commands/ and src/lib/interfaces/
- [02-01]: dorny/paths-filter at step level (not paths-ignore at workflow level) to avoid deadlock with required status checks
- [02-01]: biome ci directly with --reporter=github (ultracite wrapper doesn't support GitHub annotations)
- [02-01]: Coverage badge Gist ID stored as repository variable (not hardcoded)
- [02-02]: lcov apt-get install needed for genhtml in CI (zgosalvez/github-actions-report-lcov dependency)
- [03-01]: types: [] in tsconfig.build.json to avoid bun-types ambient declaration conflicts during tsc emit
- [03-01]: Removed templates/ from files array (templates are code-defined in src/lib/templates.ts, bundled into dist/)
- [03-01]: repository.url changed to git+ format for npm OIDC trusted publishing URL matching
- [03-02]: Split workflow pattern (release.yml + publish.yml) per changesets/action issue #515
- [03-02]: OIDC Trusted Publishing over NPM_TOKEN secret for zero-maintenance automated publishing
- [03-02]: npm upgraded to latest in CI for OIDC support (Node 22 LTS ships npm 10.x, need >= 11.5.1)
- [03-03]: Fixed self-dependency in package.json (passive-docs-index listed itself as dependency)
- [03-03]: Enabled GitHub Actions PR creation permission for changesets/action
- [03-03]: Merge commit strategy (not squash) for feature branch to preserve commit history
- [04-01]: Shallow error hierarchy (2 levels: PDIError base + ConfigError/Context7Error/NotInitializedError)
- [04-01]: Custom Zod issue formatting (not z.prettifyError()) for control over output
- [04-01]: Doctor command unchanged (diagnostic tool that catches errors gracefully)
- [04-02]: handleCommandError extracted to src/lib/error-handler.ts (avoids cli.ts side-effect issues in tests)
- [04-02]: Explicit try-catch + handleCommandError pattern (simpler than wrapCommand HOF)
- [04-02]: Added "failed to fetch" pattern to Context7 network detection
- [05-01]: npm registry client uses abbreviated metadata Accept header for minimal payload
- [05-01]: p-limit(5) for concurrent registry fetches (reuses existing dependency)
- [05-01]: semver.coerce() for loose version handling (18.x, v19, etc.)
- [05-01]: Framework-to-npm-package mapping extracted from KNOWN_FRAMEWORKS regex patterns
- [05-02]: node ./dist/postinstall.js over npx pdi status (faster, no resolution overhead, spirit of decision honored)
- [05-02]: ANSI codes directly in postinstall (no chalk import for minimal overhead)
- [05-02]: stderr for all postinstall output (npm 7+ suppresses dependency stdout)
- [05-02]: StatusCommandOptions interface with check/format fields

### Pending Todos

- Coverage badge Gist setup (manual, deferred -- badge shows "invalid" until configured)
- Branch protection activation via scripts/setup-branch-protection.sh (manual, one-time)
- Bun trustedDependencies documentation for postinstall hook (Bun blocks dependency lifecycle scripts by default)

### Blockers/Concerns

- ~~Codebase has silent exception swallowing and tight I/O coupling~~ (RESOLVED in 01-01: 5 catches fixed with console.error, IMcpClient extracted, projectRoot added)
- Context7 SDK is pre-1.0 (0.3.0) -- monitor for breaking changes
- ~~`bun publish --provenance` not available~~ (RESOLVED: using npm publish with OIDC in publish.yml, verified working with v0.2.1)
- Pre-existing test failures from Phase 4 uncommitted changes (89 fails in integration/config tests -- not caused by Phase 5)

## Session Continuity

Last session: 2026-02-13
Stopped at: Phase 5 executed (2 plans, 2 waves) and verified. Phase 6 (Claude Code Skills & Hooks) ready for planning.
Resume file: None
