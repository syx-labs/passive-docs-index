# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Documentacao de frameworks sempre disponivel no contexto do assistente de IA, sem decisao de busca necessaria
**Current focus:** Phase 4 - Error Handling & Validation

## Current Position

Phase: 4 of 10 (Error Handling & Validation)
Plan: 0 of ? in current phase (phase not yet planned)
Status: Phase 3 complete, Phase 4 ready for planning
Last activity: 2026-02-13 -- Completed 03-02 (Publish Workflow)

Progress: [########----------] 38%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~5m 00s
- Total execution time: ~0.68 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 Testing Infrastructure | 4/4 | 26m 51s | 6m 43s |
| 02 CI/CD Pipeline | 2/2 | ~5m | ~2m 30s |
| 03 Publishing & Distribution | 2/2 | ~8m | ~4m |

**Recent Trend:**
- Last 4 plans: 02-01 (2m 43s), 02-02 (multi-session), 03-01 (2m 43s), 03-02 (~5m)
- Trend: Config/infra plans continue fast (~2-5 min)

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

### Pending Todos

- Coverage badge Gist setup (manual, deferred -- badge shows "invalid" until configured)
- Branch protection activation via scripts/setup-branch-protection.sh (manual, one-time)

### Blockers/Concerns

- ~~Codebase has silent exception swallowing and tight I/O coupling~~ (RESOLVED in 01-01: 5 catches fixed with console.error, IMcpClient extracted, projectRoot added)
- Context7 SDK is pre-1.0 (0.3.0) -- monitor for breaking changes
- `bun publish --provenance` not available -- must use npm for publish step

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 03-02-PLAN.md (Publish Workflow). Phase 3 complete. Phase 4 (Error Handling & Validation) ready for planning.
Resume file: None
