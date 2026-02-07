# Phase 1: Testing Infrastructure - Research

**Researched:** 2026-02-05
**Domain:** bun:test testing framework, mocking strategies, coverage enforcement, testability refactoring
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Mocking strategy
- Use `bun:test` module mocks (`mock.module()`) for filesystem -- no changes to function signatures
- Use HTTP interceptor for Context7 API calls -- validates URLs and payloads, not just return values
- Create an MCP client abstraction interface that can be replaced by a fake in tests -- enables clean testing of MCP CLI interactions without mocking subprocess execution
- Use real fixtures (captured API responses, real config.json structures) for test data -- not minimal invented objects

#### Test organization
- Tests live in `tests/` directory, separated from `src/` -- mirrors src/ structure (`tests/unit/`, `tests/integration/`)
- File naming convention: `*.test.ts` (e.g., `config.test.ts`, `index-parser.test.ts`)
- Fixtures centralized in `tests/fixtures/` -- shared across unit and integration tests
- Shared test helpers (factory functions, setup/teardown utils) in `tests/helpers/`

#### Testability refactoring
- Deep refactoring -- extract abstraction layers (MCP client interface, fs adapter patterns) that improve testability AND prepare for future phases
- Silent exception swallowing: log errors before propagating them -- immediate visibility + errors don't disappear (prepares Phase 4)
- CLI external behavior can be improved if current behavior is inconsistent or error messages are poor
- config.json format can evolve if needed, with automatic migration from old format

#### Coverage and thresholds
- 80%+ coverage per module -- each module (config, templates, index-parser, fs-utils) must individually reach 80%
- Coverage below threshold blocks the build -- `bun test` fails if any module drops below 80%
- Measure both lines AND branches -- catches untested if/else and switch paths
- Output: terminal summary during test runs + lcov format for CI tooling (Codecov/Coveralls in Phase 2)

### Claude's Discretion
- Exact HTTP interceptor library choice (msw, nock, or bun-native approach)
- Internal module boundaries during refactoring -- how to split tightly coupled code
- Test naming conventions within describe/it blocks
- Setup/teardown patterns for each test category

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This research covers the testing infrastructure needed for the PDI (Passive Docs Index) CLI tool, a Bun/TypeScript project with 13 library modules and 9 CLI commands. The codebase has zero existing tests, no `bunfig.toml`, and significant I/O coupling (direct `node:fs`, `node:child_process`, and global `fetch` calls throughout).

The standard approach is to use `bun:test` with its built-in `mock.module()` for filesystem mocking and `spyOn(global, 'fetch')` for HTTP interception (Context7 SDK uses `fetch` internally). MSW is NOT compatible with Bun runtime -- this was verified through the official MSW GitHub issue tracker (issue #1718, closed as "won't fix"). For MCP CLI subprocess testing, the user's decision to create an abstraction interface is the correct pattern, as it avoids mocking `child_process.spawn` which is unreliable in Bun.

Two critical limitations of Bun's test runner were discovered that conflict with user decisions: (1) Bun does NOT support branch coverage reporting (GitHub issue #7100, still open), and (2) Bun does NOT support per-module/per-file coverage thresholds (GitHub issue #5099, still open). The research provides workarounds for both.

**Primary recommendation:** Use `bun:test` native mocking (`mock.module()` + `spyOn(global, 'fetch')`) with a custom post-test script for per-module coverage enforcement, since Bun lacks both branch coverage and per-module thresholds natively.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bun:test` | built-in (Bun 1.3.8) | Test runner, assertions, mocks | Locked decision; native to project runtime |
| `bun:test` mock.module() | built-in | Module-level mocking for fs | Replaces module exports without signature changes |
| `bun:test` spyOn() | built-in | Function/method spy + mock | Intercepts `global.fetch` for HTTP testing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | - | HTTP interceptor | `spyOn(global, 'fetch')` suffices (see recommendation below) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| spyOn(global, 'fetch') | MSW | MSW does NOT work with Bun -- uses `node:http` internals Bun hasn't implemented |
| spyOn(global, 'fetch') | nock | nock patches `node:http` -- same Bun incompatibility problem |
| spyOn(global, 'fetch') | bun-mock-fetch | Thin wrapper around spyOn; adds unnecessary dependency |
| Custom per-module script | Native Bun threshold | Bun only supports global thresholds, not per-module |

**HTTP Interceptor Recommendation (Claude's Discretion):**

Use `spyOn(global, 'fetch')` directly. Reasoning:
1. The Context7 SDK (`@upstash/context7-sdk`) uses `fetch()` internally (verified by reading `node_modules/@upstash/context7-sdk/dist/client.js` line 60)
2. MSW is explicitly incompatible with Bun (GitHub mswjs/msw#1718, closed as "won't ship anything specific to Bun")
3. nock patches `node:http` which has the same Bun incompatibility (Bun's `node:http` emulation is incomplete)
4. `spyOn(global, 'fetch')` can validate URLs, payloads, AND return shaped responses -- meeting the user's requirement to validate more than just return values
5. Zero additional dependencies

**Installation:**
```bash
# No additional packages needed -- bun:test is built-in
# Only need to create bunfig.toml for configuration
```

## Architecture Patterns

### Recommended Project Structure
```
tests/
  unit/
    lib/
      config.test.ts          # Tests for src/lib/config.ts
      fs-utils.test.ts         # Tests for src/lib/fs-utils.ts
      index-parser.test.ts     # Tests for src/lib/index-parser.ts
      templates.test.ts        # Tests for src/lib/templates.ts
      context7.test.ts         # Tests for src/lib/context7.ts
      context7-client.test.ts  # Tests for src/lib/context7-client.ts
      mcp-client.test.ts       # Tests for src/lib/mcp-client.ts
      index-utils.test.ts      # Tests for src/lib/index-utils.ts
      constants.test.ts        # Tests for src/lib/constants.ts (if needed)
      types.test.ts            # Tests for src/lib/types.ts (if needed)
  integration/
    commands/
      init.test.ts             # Integration tests for init command
      add.test.ts              # Integration tests for add command
      sync.test.ts             # Integration tests for sync command
      status.test.ts           # Integration tests for status command
      clean.test.ts            # Integration tests for clean command
      update.test.ts           # Integration tests for update command
  fixtures/
    config/
      valid-config.json        # Real config.json structure
      minimal-config.json      # Minimal valid config
      legacy-config.json       # Old format (for migration tests)
    context7/
      search-library.json      # Captured Context7 search response
      query-docs.json          # Captured Context7 query response
      error-response.json      # Error/redirect responses
    package-json/
      cli-project.json         # package.json for CLI project type
      frontend-project.json    # package.json for frontend project type
      fullstack-project.json   # package.json for fullstack project type
    claude-md/
      with-index.md            # CLAUDE.md with existing PDI markers
      without-index.md         # CLAUDE.md without PDI markers
    mcp/
      query-result.json        # Captured MCP CLI output
  helpers/
    setup.ts                   # Global test setup (preload)
    factories.ts               # Factory functions for test data
    mock-fetch.ts              # Fetch interceptor helper
    mock-fs.ts                 # Filesystem mock helpers
    mock-mcp.ts                # MCP client fake implementation
scripts/
  check-coverage.ts            # Per-module coverage enforcement script
bunfig.toml                    # Bun test configuration
```

### Pattern 1: Module Mocking with mock.module()
**What:** Replace filesystem module at import time without changing function signatures
**When to use:** Any test that needs to isolate filesystem I/O
**Example:**
```typescript
// Source: Bun official docs - https://github.com/oven-sh/bun/blob/main/docs/test/mocks.mdx
import { test, expect, mock, beforeEach } from "bun:test";

// Mock node:fs and node:fs/promises at module level
mock.module("node:fs", () => ({
  existsSync: mock((path: string) => {
    // Return based on test scenario
    return mockFileSystem.has(path);
  }),
}));

mock.module("node:fs/promises", () => ({
  readFile: mock(async (path: string) => {
    const content = mockFileSystem.get(path);
    if (!content) throw new Error(`ENOENT: ${path}`);
    return content;
  }),
  writeFile: mock(async (path: string, content: string) => {
    mockFileSystem.set(path, content);
  }),
  mkdir: mock(async () => {}),
  readdir: mock(async () => []),
  rm: mock(async () => {}),
  stat: mock(async () => ({ isDirectory: () => false, size: 0 })),
}));

// State for the mock filesystem
let mockFileSystem: Map<string, string>;

beforeEach(() => {
  mockFileSystem = new Map();
});

test("readConfig returns config when file exists", async () => {
  const config = { version: "1.0.0", project: { name: "test", type: "cli" } };
  mockFileSystem.set("/project/.claude-docs/config.json", JSON.stringify(config));

  const { readConfig } = await import("../../src/lib/config.js");
  const result = await readConfig("/project");
  expect(result).toEqual(config);
});
```

### Pattern 2: HTTP Interception with spyOn(global, 'fetch')
**What:** Intercept all fetch() calls to validate requests and return mock responses
**When to use:** Testing Context7 HTTP SDK calls (context7-client.ts)
**Example:**
```typescript
// Source: Bun GitHub discussion #11169 + official docs
import { test, expect, spyOn, beforeEach, afterEach } from "bun:test";

let fetchSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  fetchSpy = spyOn(global, "fetch").mockImplementation(async (url, options) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    // Validate the URL and payload
    if (urlStr.includes("/api/search")) {
      expect(options?.method).toBe("POST");
      const body = JSON.parse(options?.body as string);
      expect(body).toHaveProperty("query");

      return Response.json([{ id: "/honojs/hono", name: "Hono" }]);
    }

    if (urlStr.includes("/api/context")) {
      return Response.json([
        { title: "Routing", content: "# Hono Routing", source: "docs" },
      ]);
    }

    return new Response("Not Found", { status: 404 });
  });
});

afterEach(() => {
  fetchSpy.mockRestore();
});

test("queryContext7 sends correct request to Context7 API", async () => {
  const { queryContext7 } = await import("../../src/lib/context7-client.js");
  const result = await queryContext7("/honojs/hono", "routing", {
    apiKey: "ctx7sk-test-key",
  });

  expect(result.success).toBe(true);
  expect(fetchSpy).toHaveBeenCalled();

  // Validate the actual URL that was called
  const [calledUrl] = fetchSpy.mock.calls[0];
  expect(calledUrl.toString()).toContain("/honojs/hono");
});
```

### Pattern 3: MCP Client Abstraction Interface
**What:** Extract an interface from the current mcp-client.ts, allowing a fake implementation in tests
**When to use:** Testing any code that interacts with MCP CLI (command files that use context7-client which falls back to MCP)
**Example:**
```typescript
// Interface extracted from current mcp-client.ts behavior
export interface IMcpClient {
  isAvailable(): Promise<boolean>;
  queryDocs(libraryId: string, query: string): Promise<McpResult>;
  resolveLibrary(libraryName: string): Promise<McpResult>;
}

export interface McpResult {
  success: boolean;
  content?: string;
  error?: string;
}

// Production implementation wraps existing mcp-client.ts functions
export class McpCliClient implements IMcpClient {
  async isAvailable(): Promise<boolean> {
    return isMcpCliAvailable();
  }
  async queryDocs(libraryId: string, query: string): Promise<McpResult> {
    return queryContext7(libraryId, query);
  }
  async resolveLibrary(libraryName: string): Promise<McpResult> {
    return resolveContext7Library(libraryName);
  }
}

// Test fake -- no subprocess, no network
export class FakeMcpClient implements IMcpClient {
  private available = true;
  private responses = new Map<string, McpResult>();

  setAvailable(available: boolean) { this.available = available; }
  setResponse(key: string, result: McpResult) { this.responses.set(key, result); }

  async isAvailable(): Promise<boolean> { return this.available; }
  async queryDocs(libraryId: string, query: string): Promise<McpResult> {
    return this.responses.get(`${libraryId}:${query}`) ?? { success: false, error: "not configured" };
  }
  async resolveLibrary(libraryName: string): Promise<McpResult> {
    return this.responses.get(`resolve:${libraryName}`) ?? { success: false, error: "not configured" };
  }
}
```

### Pattern 4: Integration Test with Full Mock Stack
**What:** Test a CLI command end-to-end with all I/O mocked
**When to use:** Integration tests for each command (init, add, sync, status, clean, update)
**Example:**
```typescript
import { describe, test, expect, mock, spyOn, beforeEach } from "bun:test";

// Mock filesystem, fetch, and console at the top
mock.module("node:fs", () => ({ existsSync: mock(() => false) }));
mock.module("node:fs/promises", () => ({
  readFile: mock(async () => "{}"),
  writeFile: mock(async () => {}),
  mkdir: mock(async () => {}),
}));

// Capture console output
const consoleSpy = {
  log: spyOn(console, "log").mockImplementation(() => {}),
  error: spyOn(console, "error").mockImplementation(() => {}),
};

describe("init command", () => {
  beforeEach(() => {
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  test("creates config.json and .claude-docs structure", async () => {
    // Set up mock filesystem state
    const { existsSync } = require("node:fs");
    const { writeFile, mkdir } = require("node:fs/promises");

    // Simulate package.json exists, config does not
    existsSync.mockImplementation((path: string) => {
      return path.endsWith("package.json");
    });

    const { readFile } = require("node:fs/promises");
    readFile.mockImplementation(async (path: string) => {
      if (path.endsWith("package.json")) {
        return JSON.stringify({ name: "test-project", dependencies: {} });
      }
      throw new Error("ENOENT");
    });

    // Run the command
    const { initCommand } = await import("../../src/commands/init.js");
    await initCommand({ force: false });

    // Verify mkdir was called for .claude-docs
    expect(mkdir).toHaveBeenCalled();
    // Verify config.json was written
    expect(writeFile).toHaveBeenCalled();
  });
});
```

### Anti-Patterns to Avoid
- **Mocking ora/chalk/prompts inline:** These UI libraries should NOT be deeply mocked. Instead, capture `console.log` output or mock `process.stdout.write` at a high level. Commands that use `prompts` need the prompts module mocked to return predetermined responses.
- **Testing process.cwd() directly:** Commands use `process.cwd()` for project root. In tests, mock this or refactor commands to accept `projectRoot` as a parameter.
- **Importing modules before mock.module():** `mock.module()` must be called BEFORE importing the modules that depend on the mocked module. Use dynamic `import()` after setting up mocks.
- **Sharing mock state between tests:** Each test must reset mock filesystem state in `beforeEach`. Bun runs tests in a single process by default, so module-level mocks persist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP request interception | Custom fetch wrapper | `spyOn(global, 'fetch')` | Built-in, validates URL/payload, returns Response objects |
| Module mocking | Manual dependency injection | `mock.module()` | Updates live bindings for both ESM and CJS |
| Test fixture management | Manual JSON.parse in each test | Factory functions in `tests/helpers/factories.ts` | Reusable, type-safe, consistent across tests |
| Coverage threshold checking | Manual lcov parsing | Bun's `coverageThreshold` + custom script for per-module | Global threshold is built-in; per-module needs a script |
| Console output capture | Custom stream interceptor | `spyOn(console, 'log')` | Built into bun:test spyOn |

**Key insight:** Bun's built-in test utilities cover 90% of mocking needs. The only gap is per-module coverage thresholds, which needs a lightweight custom script.

## Common Pitfalls

### Pitfall 1: mock.module() Import Order
**What goes wrong:** Tests fail silently or use real modules instead of mocks
**Why it happens:** `mock.module()` must be called before any `import` statement that loads the target module. If you import at the top of the file, the real module is already cached.
**How to avoid:** Always call `mock.module()` at file top level, before any `import` of dependent modules. Use dynamic `await import()` inside test functions for the modules being tested.
**Warning signs:** Tests pass when run alone but fail in suite; filesystem operations actually hit disk in tests.

### Pitfall 2: Bun Does NOT Support Branch Coverage
**What goes wrong:** User decided "measure both lines AND branches" but Bun only reports line and function coverage -- branch coverage (BRDA in lcov format) is not implemented.
**Why it happens:** Bun's coverage is based on its internal code generation which doesn't track branch-level execution. GitHub issue #7100 is open since Nov 2023, assigned but not shipped.
**How to avoid:** Use lcov output and process it with an external tool if branch data is critical. Alternatively, accept line + function coverage as the enforced metrics and defer branch coverage to Phase 2 CI (which can use a separate tool like c8 or istanbul to post-process lcov).
**Warning signs:** `coverageThreshold = { lines = 0.8, functions = 0.8, statements = 0.8 }` works but there is no `branches` key in Bun's coverage config.

### Pitfall 3: Bun Does NOT Support Per-Module Coverage Thresholds
**What goes wrong:** User decided "80%+ coverage per module" but Bun only supports a single global coverage threshold -- not per-file or per-folder.
**Why it happens:** GitHub issue #5099 requested this feature in Sep 2023, still open and not implemented.
**How to avoid:** Write a custom `scripts/check-coverage.ts` that parses the lcov.info output and verifies per-module thresholds. Run it as a post-test step: `bun test --coverage && bun run scripts/check-coverage.ts`.
**Warning signs:** Global threshold passes but individual modules have low coverage.

### Pitfall 4: Bun Coverage Only Reports Imported Files
**What goes wrong:** Coverage shows 100% but entire modules were never tested (they just weren't imported, so they're invisible to the coverage tracker).
**Why it happens:** Bun only tracks coverage for files that are actually `import`-ed during test execution.
**How to avoid:** Create a `tests/coverage-loader.test.ts` file that dynamically imports all `src/lib/*.ts` modules to ensure they appear in coverage reports. Use `Bun.Glob` to discover files.
**Warning signs:** Coverage report shows fewer files than exist in `src/lib/`.

### Pitfall 5: process.cwd() Coupling in Commands
**What goes wrong:** Command tests affect the real filesystem or fail because process.cwd() returns the test runner's directory, not a mock project directory.
**Why it happens:** Every command starts with `const projectRoot = process.cwd()`. There's no way to pass a custom root.
**How to avoid:** During refactoring, make commands accept an optional `projectRoot` parameter (defaulting to `process.cwd()`). This is a minimal signature change that dramatically improves testability.
**Warning signs:** Tests need `process.chdir()` calls, which affect all tests in the process.

### Pitfall 6: Module-Level Side Effects in context7-client.ts and mcp-client.ts
**What goes wrong:** Module-level caching (`let httpClient = null`, `let mcpCliAvailable = null`) leaks state between tests.
**Why it happens:** These modules use file-scoped mutable variables as caches. Bun runs all tests in a single process.
**How to avoid:** Both modules already have `resetClients()` / `resetMcpCliCache()` functions. Call these in `beforeEach()` or `afterEach()` for every test file that touches these modules.
**Warning signs:** Tests pass when run individually but fail when run as a suite.

### Pitfall 7: Mocking prompts for Interactive Commands
**What goes wrong:** Tests hang waiting for user input
**Why it happens:** add, sync, clean, and update commands use the `prompts` library for interactive input
**How to avoid:** Use `mock.module("prompts", ...)` to return predetermined responses. The prompts library exports a default function, so mock it as `mock.module("prompts", () => ({ default: mock(async () => ({ frameworks: ["hono"] })) }))`.
**Warning signs:** Tests that work in non-interactive mode but hang when testing interactive paths.

## Code Examples

### bunfig.toml Configuration
```toml
# Source: Bun official docs - https://bun.sh/docs/test/configuration
[test]
# Test discovery
root = "."
preload = ["./tests/helpers/setup.ts"]

# Coverage configuration
coverage = true
coverageReporter = ["text", "lcov"]
coverageDir = "./coverage"
coverageThreshold = 0.8
coverageSkipTestFiles = true
coveragePathIgnorePatterns = [
  "tests/**",
  "dist/**",
  "scripts/**",
  "*.config.*"
]
```

### Global Test Setup (tests/helpers/setup.ts)
```typescript
// Source: Pattern derived from Bun docs lifecycle hooks
import { beforeEach, afterEach } from "bun:test";
import { resetClients } from "../../src/lib/context7-client.js";
import { resetMcpCliCache } from "../../src/lib/mcp-client.js";

// Reset all cached state between tests
beforeEach(() => {
  resetClients();
  resetMcpCliCache();
});

// Ensure no real fetch calls leaked through
afterEach(() => {
  // Safety check: if a real fetch was made, fail loudly
});
```

### Coverage Loader (tests/coverage-loader.test.ts)
```typescript
// Source: Pattern from https://www.charpeni.com/blog/bun-code-coverage-gap
import { test } from "bun:test";

// Force Bun to load all source modules for coverage tracking
test("all source modules are loaded for coverage", async () => {
  const glob = new Bun.Glob("src/lib/**/*.ts");
  for await (const file of glob.scan({ cwd: import.meta.dir + "/../.." })) {
    if (!file.endsWith(".d.ts")) {
      await import(`../../${file}`);
    }
  }
});
```

### Per-Module Coverage Script (scripts/check-coverage.ts)
```typescript
#!/usr/bin/env bun
/**
 * Parse lcov.info and enforce per-module coverage thresholds.
 * Exits with code 1 if any module is below threshold.
 */
const THRESHOLD = 0.8; // 80%
const MODULES = ["config", "templates", "index-parser", "fs-utils", "context7", "context7-client", "mcp-client", "index-utils"];

const lcov = await Bun.file("coverage/lcov.info").text();

interface FileCoverage {
  file: string;
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
}

function parseLcov(content: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let current: Partial<FileCoverage> = {};

  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) {
      current = { file: line.slice(3) };
    } else if (line.startsWith("LF:")) {
      current.linesFound = parseInt(line.slice(3));
    } else if (line.startsWith("LH:")) {
      current.linesHit = parseInt(line.slice(3));
    } else if (line.startsWith("FNF:")) {
      current.functionsFound = parseInt(line.slice(4));
    } else if (line.startsWith("FNH:")) {
      current.functionsHit = parseInt(line.slice(4));
    } else if (line === "end_of_record") {
      if (current.file) {
        files.push(current as FileCoverage);
      }
      current = {};
    }
  }
  return files;
}

const fileCoverages = parseLcov(lcov);
let failed = false;

for (const mod of MODULES) {
  const moduleFiles = fileCoverages.filter(f => f.file.includes(`src/lib/${mod}`));
  if (moduleFiles.length === 0) {
    console.error(`WARNING: No coverage data for module "${mod}"`);
    continue;
  }

  const totalLines = moduleFiles.reduce((s, f) => s + f.linesFound, 0);
  const hitLines = moduleFiles.reduce((s, f) => s + f.linesHit, 0);
  const lineCoverage = totalLines > 0 ? hitLines / totalLines : 0;

  const totalFns = moduleFiles.reduce((s, f) => s + f.functionsFound, 0);
  const hitFns = moduleFiles.reduce((s, f) => s + f.functionsHit, 0);
  const fnCoverage = totalFns > 0 ? hitFns / totalFns : 0;

  const status = lineCoverage >= THRESHOLD && fnCoverage >= THRESHOLD ? "PASS" : "FAIL";
  if (status === "FAIL") failed = true;

  console.log(`${status}: ${mod} - lines: ${(lineCoverage * 100).toFixed(1)}%, functions: ${(fnCoverage * 100).toFixed(1)}%`);
}

if (failed) {
  console.error(`\nCoverage below ${THRESHOLD * 100}% threshold for one or more modules.`);
  process.exit(1);
}

console.log(`\nAll modules meet ${THRESHOLD * 100}% coverage threshold.`);
```

### Fetch Mock Helper (tests/helpers/mock-fetch.ts)
```typescript
import { spyOn, mock } from "bun:test";

export interface FetchRoute {
  pattern: string | RegExp;
  method?: string;
  response: Response | ((url: string, options?: RequestInit) => Response | Promise<Response>);
}

export function createFetchMock(routes: FetchRoute[]) {
  return spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = init?.method || "GET";

    for (const route of routes) {
      const matches = typeof route.pattern === "string"
        ? url.includes(route.pattern)
        : route.pattern.test(url);

      if (matches && (!route.method || route.method === method)) {
        return typeof route.response === "function"
          ? route.response(url, init)
          : route.response.clone();
      }
    }

    throw new Error(`Unmocked fetch: ${method} ${url}`);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MSW for HTTP mocking | spyOn(global, 'fetch') for Bun | MSW never supported Bun (issue since Aug 2023) | Must use native Bun mocking for HTTP |
| Jest/Vitest module mocking | bun:test mock.module() | Bun 1.0+ (Sept 2023) | Live binding replacement for ESM + CJS |
| Istanbul/c8 for coverage | Bun built-in coverage | Bun 1.0+ | Simpler, but missing branch coverage |
| Per-file coverage via Jest config | Not available in Bun | Still not implemented (issue #5099) | Need custom script |

**Deprecated/outdated:**
- `bun-bagel` (early Bun fetch mock library): abandoned, no longer maintained
- Manual `global.fetch = ...` override: Works but loses spy capabilities. Use `spyOn` instead.

## Codebase Analysis: Testability Issues Found

### Tight I/O Coupling
Every module in `src/lib/` directly imports from `node:fs` and `node:fs/promises`. This is addressable via `mock.module()` without changing signatures.

Specific coupling points:
- **config.ts**: `existsSync`, `readFile`, `writeFile`, `mkdir` (7 direct fs calls)
- **fs-utils.ts**: `existsSync`, `mkdir`, `readdir`, `readFile`, `rm`, `stat`, `writeFile` (entire module is fs operations)
- **index-parser.ts**: `existsSync`, `readFile`, `writeFile` (for CLAUDE.md operations)
- **mcp-client.ts**: `execSync`, `spawn`, `existsSync`, `readdirSync`, `homedir` (subprocess + fs)
- **context7-client.ts**: Global `fetch` via Context7 SDK + mcp-client imports

### Silent Exception Swallowing
Found 6 instances of `catch {}` or `catch { return null }` with no logging:
1. `config.ts:117-119` -- readPackageJson catches all errors silently
2. `context7-client.ts:61-64` -- getHttpClient catches creation errors
3. `context7-client.ts:133-135` -- resolveLibraryId catches search errors
4. `context7-client.ts:363-365` -- searchLibrary catches all errors
5. `mcp-client.ts:70-73` -- findInPath catches command errors
6. `generate.ts:289` -- scanProjectFiles catches readdir errors

These should get `console.error` or structured logging during refactoring (as per user decision).

### process.cwd() Coupling in Commands
All 9 command files start with `const projectRoot = process.cwd()`. The init, add, sync, status, clean, update commands all need this refactored to accept an optional parameter.

### Module-Level State
- `context7-client.ts`: `httpClient`, `httpClientApiKey`, `libraryIdCache` (has `resetClients()`)
- `mcp-client.ts`: `mcpCliInfo`, `mcpCliAvailable` (has `resetMcpCliCache()`)
- `cli.ts`: Top-level `await loadApiKeyFromConfig()` (side effect on import)

### Commands That Use Interactive Prompts
- `add.ts`: Uses `prompts` for framework selection
- `sync.ts`: Uses `prompts` for confirmation
- `clean.ts`: Uses `prompts` for removal confirmation
- `update.ts`: Uses `prompts` for update confirmation
- `auth.ts`: Uses `prompts` for API key input
- `generate.ts`: Uses `prompts` for generation confirmation

## Open Questions

1. **Branch coverage timing**
   - What we know: Bun does not support branch coverage reporting. Issue #7100 is open and assigned.
   - What's unclear: Whether this will ship before Phase 2 CI setup begins.
   - Recommendation: Enforce line + function coverage now (80% each). Add a TODO for branch coverage. The lcov output can be post-processed by an external tool in Phase 2 CI if Bun still lacks native support.

2. **Per-module threshold granularity**
   - What we know: The custom `scripts/check-coverage.ts` approach works but adds a build step.
   - What's unclear: Whether to fail the entire test run or just warn when one module is below threshold.
   - Recommendation: Fail the build. Add it to the `test` script: `"test": "bun test --coverage && bun run scripts/check-coverage.ts"`.

3. **Refactoring depth for commands accepting projectRoot**
   - What we know: Commands use `process.cwd()` and need it parameterized for testing.
   - What's unclear: Whether to change the CLI interface (add --root flag) or just the internal function signatures.
   - Recommendation: Only change internal function signatures (add optional `projectRoot` parameter with default `process.cwd()`). Don't add a CLI flag yet -- that's a feature change outside Phase 1 scope.

## Sources

### Primary (HIGH confidence)
- Bun official docs via Context7 `/oven-sh/bun` -- mock.module(), spyOn, lifecycle hooks, coverage configuration
- `@upstash/context7-sdk` source code (node_modules) -- confirmed uses fetch() internally
- MSW GitHub issue #1718 -- confirmed MSW does NOT support Bun runtime
- Bun GitHub issue #7100 -- confirmed branch coverage NOT implemented
- Bun GitHub issue #5099 -- confirmed per-module coverage thresholds NOT supported
- PDI codebase analysis -- all 22 source files read and analyzed for coupling patterns

### Secondary (MEDIUM confidence)
- Bun GitHub discussion #11169 -- spyOn(global, 'fetch') recommended by community for Bun HTTP mocking
- https://www.charpeni.com/blog/bun-code-coverage-gap -- coverage-loader pattern for ensuring all files appear in reports

### Tertiary (LOW confidence)
- None -- all findings were verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified against Bun official docs via Context7 and codebase analysis
- Architecture: HIGH -- patterns derived from official Bun docs and verified API behavior
- Pitfalls: HIGH -- all limitations verified via GitHub issues with issue numbers
- HTTP interceptor recommendation: HIGH -- MSW incompatibility confirmed via official GitHub issue; spyOn approach verified in Bun docs
- Coverage workarounds: MEDIUM -- custom script pattern is sound but untested in this specific project

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- Bun releases frequently but core test API is stable)
