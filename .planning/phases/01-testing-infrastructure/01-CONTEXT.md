# Phase 1: Testing Infrastructure - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Unit and integration test suite with testability refactoring for PDI v1.0. Covers: test framework setup (bun:test), mocking strategy for all external I/O (filesystem, Context7 HTTP, MCP CLI), test organization, testability refactoring of existing code, and coverage enforcement. Does NOT add new features or change CLI capabilities — focuses on making the existing code verifiable.

</domain>

<decisions>
## Implementation Decisions

### Mocking strategy
- Use `bun:test` module mocks (`mock.module()`) for filesystem — no changes to function signatures
- Use HTTP interceptor for Context7 API calls — validates URLs and payloads, not just return values
- Create an MCP client abstraction interface that can be replaced by a fake in tests — enables clean testing of MCP CLI interactions without mocking subprocess execution
- Use real fixtures (captured API responses, real config.json structures) for test data — not minimal invented objects

### Test organization
- Tests live in `tests/` directory, separated from `src/` — mirrors src/ structure (`tests/unit/`, `tests/integration/`)
- File naming convention: `*.test.ts` (e.g., `config.test.ts`, `index-parser.test.ts`)
- Fixtures centralized in `tests/fixtures/` — shared across unit and integration tests
- Shared test helpers (factory functions, setup/teardown utils) in `tests/helpers/`

### Testability refactoring
- Deep refactoring — extract abstraction layers (MCP client interface, fs adapter patterns) that improve testability AND prepare for future phases
- Silent exception swallowing: log errors before propagating them — immediate visibility + errors don't disappear (prepares Phase 4)
- CLI external behavior can be improved if current behavior is inconsistent or error messages are poor
- config.json format can evolve if needed, with automatic migration from old format

### Coverage and thresholds
- 80%+ coverage per module — each module (config, templates, index-parser, fs-utils) must individually reach 80%
- Coverage below threshold blocks the build — `bun test` fails if any module drops below 80%
- Measure both lines AND branches — catches untested if/else and switch paths
- Output: terminal summary during test runs + lcov format for CI tooling (Codecov/Coveralls in Phase 2)

### Claude's Discretion
- Exact HTTP interceptor library choice (msw, nock, or bun-native approach)
- Internal module boundaries during refactoring — how to split tightly coupled code
- Test naming conventions within describe/it blocks
- Setup/teardown patterns for each test category

</decisions>

<specifics>
## Specific Ideas

- MCP client abstraction should be a clean interface that Phase 4 (Error Handling) and Phase 6 (Claude Code Skills) can build on — not a throwaway test seam
- Fixtures should capture real Context7 responses so tests validate actual data shapes, not assumptions
- Logging added during refactoring should be minimal and structured — prepare for but don't implement full error handling (that's Phase 4)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-testing-infrastructure*
*Context gathered: 2026-02-05*
