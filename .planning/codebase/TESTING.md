# Testing Patterns

**Analysis Date:** 2026-02-05

## Test Framework

**Status:** Not implemented

**Test Configuration:**
- Package script defined: `"test": "bun test"` in `package.json`
- No test runner configuration file found (no `jest.config.*`, `vitest.config.*`, `bun.config.ts`)
- Bun's native test runner would be used (requires `bun test` command)
- No test files present in codebase (no `*.test.ts`, `*.spec.ts` files found)

**Assertion Library:**
- Not yet selected; Bun's native testing includes basic assertion capabilities
- Common choices for future implementation: Vitest, Jest, or Bun's built-in test API

**Run Commands:**
```bash
bun test                     # Run all tests (not yet configured)
```

## Test File Organization

**Current Status:** No test files exist

**Recommended Structure:**
- Location: `src/**/__tests__/` (co-located with source code) or `tests/` directory (separate)
- Naming convention: `[module].test.ts` or `[module].spec.ts`
- Command test structure: `src/commands/__tests__/init.test.ts`
- Library test structure: `src/lib/__tests__/config.test.ts`

**TypeScript Integration:**
- tsconfig.json configured for ES2022 target
- Would need test-specific tsconfig if using separate test runner

## Test Structure

**Recommended Pattern:**
Based on codebase architecture (command-based CLI with utility libraries), tests should follow this structure:

```typescript
import { describe, it, expect } from "bun:test";
import { initCommand } from "../../commands/init.js";
import { readConfig, writeConfig } from "../../lib/config.js";

describe("init command", () => {
  it("should create config.json when project not initialized", async () => {
    // Setup
    // Execute
    // Assert
  });

  it("should skip initialization if already initialized", async () => {
    // Setup
    // Execute
    // Assert
  });
});
```

**Patterns Observed:**
- Async/await syntax throughout codebase necessitates async tests
- Promise-based returns from utility functions
- Error handling with try-catch blocks

## Testing Approach by Module

### Command Testing

**Scope:** CLI command execution and output
- File location: `src/commands/__tests__/[command].test.ts`
- Approach: Integration-style testing of command functions
- Mock: File system, external API calls (Context7, MCP)

**Example structure for `src/commands/init.ts`:**
```typescript
describe("initCommand", () => {
  // Setup: Mock filesystem, package.json
  // Tests: Configuration creation, directory structure, dependency detection
  // Teardown: Clean test artifacts
});
```

**Key Commands to Test:**
- `initCommand()` - Creates .claude-docs structure, config.json
- `addCommand()` - Downloads/creates framework documentation
- `syncCommand()` - Synchronizes with package.json
- `statusCommand()` - Reports project state
- `updateCommand()` - Updates documentation

### Library Testing

**Scope:** Utility functions, configuration parsing, file operations
- File location: `src/lib/__tests__/[module].test.ts`
- Approach: Unit tests with controlled inputs

**Modules requiring testing:**
- `config.ts`: Project type detection, dependency detection, version cleaning
- `types.ts`: Type definitions (compile-time only)
- `constants.ts`: Constants verification
- `fs-utils.ts`: File/directory operations
- `index-parser.ts`: Index format parsing and generation
- `templates.ts`: Template loading and querying
- `context7-client.ts`: API client integration (requires mocking)
- `context7.ts`: Response processing logic

**Example for config detection:**
```typescript
describe("detectProjectType", () => {
  it("should detect backend project", () => {
    const pkg = { dependencies: { express: "^4.18.0" } };
    expect(detectProjectType(pkg)).toBe("backend");
  });

  it("should detect fullstack project", () => {
    const pkg = {
      dependencies: {
        react: "^18.0.0",
        express: "^4.18.0"
      }
    };
    expect(detectProjectType(pkg)).toBe("fullstack");
  });
});
```

## Mocking

**Framework:** Bun's test suite supports mocking via module patching

**Patterns Needed:**
- File system mocks: Mock `readFile`, `writeFile`, `mkdir`, `readdir`
- External API mocks: Mock Context7 client functions
- Package.json mocks: Provide test fixture data

**What to Mock:**
- File system operations (`fs/promises` module functions)
- External API calls to Context7
- MCP client interactions
- Subprocess execution (for future shell commands)

**What NOT to Mock:**
- Core utility functions that parse/transform data (test directly)
- Type definitions (compile-time only)
- Constants (test directly if behavior depends on them)

**Mocking Example (future implementation):**
```typescript
import { mock } from "bun:test";
import * as fs from "node:fs/promises";

mock.module("node:fs/promises", () => ({
  readFile: mock((path) => {
    if (path.includes("package.json")) {
      return JSON.stringify({ name: "test-project" });
    }
    throw new Error("File not found");
  }),
  writeFile: mock(() => Promise.resolve()),
  mkdir: mock(() => Promise.resolve()),
}));
```

## Fixtures and Factories

**Test Data:**
- Location: `src/__tests__/fixtures/` (recommended future location)
- Pattern: Factory functions for creating test data

**Fixture Types Needed:**
- Minimal package.json: `{ name: "test", dependencies: {} }`
- Package with frameworks: `{ dependencies: { react: "18.0", express: "4.18" } }`
- PDIConfig objects: Valid, minimal, malformed configs
- Framework templates: Test template structure

**Example factory (future implementation):**
```typescript
// src/__tests__/fixtures/config.ts
export function createTestConfig(overrides = {}): PDIConfig {
  return {
    ...DEFAULT_CONFIG,
    project: { name: "test-project", type: "backend" },
    ...overrides,
  };
}

export function createTestPackageJson(deps = {}): PackageJson {
  return { name: "test-project", dependencies: deps };
}
```

## Coverage

**Requirements:** None enforced

**Strategy for Future Implementation:**
- Threshold recommendation: 70% statements, 60% branches, 70% functions, 70% lines
- Focus high-risk areas first: Config parsing, dependency detection, file I/O
- Commands secondary (harder to test without full environment)

## Error Testing

**Pattern:** Test both success and error paths

**Error Scenarios to Cover:**
- Missing config file: `readConfig()` returns null
- Invalid JSON in config: Throws parsing error
- File system errors: Permission denied, disk full
- External API failures: Context7 timeout, 404 responses
- Malformed package.json: Missing required fields

**Error handling test example (future):**
```typescript
describe("readConfig error handling", () => {
  it("should return null if config file does not exist", async () => {
    const result = await readConfig("/nonexistent/path");
    expect(result).toBeNull();
  });

  it("should throw if JSON is invalid", async () => {
    mock.module("node:fs/promises", () => ({
      readFile: mock(() => Promise.resolve("invalid json {"))
    }));
    expect(() => readConfig("/path")).toThrow();
  });
});
```

## Async Testing

**Pattern:** All CLI and file system operations are async

**Implementation approach:**
```typescript
describe("async operations", () => {
  it("should handle async config reading", async () => {
    const config = await readConfig(projectRoot);
    expect(config).toBeDefined();
  });
});
```

**Promise handling:**
- Use `async/await` in tests (matches codebase style)
- Don't test Promise chains (codebase doesn't use them)
- Handle rejections with `expect().rejects.toThrow()`

## Test Types

### Unit Tests
- Scope: Individual functions with predictable inputs
- Examples: `detectProjectType()`, `cleanVersion()`, `parseIndex()`
- Approach: Direct function calls with test data

### Integration Tests
- Scope: Command execution with mocked external dependencies
- Examples: Full `initCommand()` flow, `addCommand()` with mocked Context7
- Approach: Multiple functions working together with controlled environment

### E2E Tests
- Status: Not recommended for this CLI tool (would require filesystem interaction)
- Alternative: Integration tests are sufficient for CLI validation

## CI/CD Integration

**Current Status:** No CI/CD pipeline configured

**Build Commands Available:**
```bash
bun run build          # Compiles TypeScript to dist/
bun run typecheck      # Type checking with tsc
bun run check          # Biome linting
bun run fix            # Biome auto-fixing
```

**Recommended CI Pipeline (future):**
```yaml
# Example GitHub Actions workflow
- name: Check linting
  run: bun run check

- name: Type check
  run: bun run typecheck

- name: Run tests
  run: bun test

- name: Build
  run: bun run build
```

**Pre-commit Integration:**
- Biome configured for automatic formatting on save in VSCode
- Ultracite (`ultracite` v7.1.3) configured for code quality checks
- Commands: `bun run check` (validate), `bun run fix` (auto-fix)

## Linting & Type Checking in Tests

**Type Safety:**
- `tsconfig.json` includes test files implicitly via `include: ["src/**/*"]`
- Strict mode enabled: All tests must have proper type annotations

**Linting During Testing:**
- Biome rules apply to test files as well
- Tests should follow same code style as implementation
- Import organization auto-fixed by Biome

**Mock Type Safety:**
- Mocks must type-match actual module exports
- Use `Partial<T>` for partial mocks

## Coverage Gaps (Current)

**Untested Areas (entire codebase untested):**
- `src/commands/*` - All CLI commands (10+ commands unimplemented in tests)
- `src/lib/config.ts` - Configuration management and detection
- `src/lib/context7-client.ts` - Context7 API client
- `src/lib/templates.ts` - Template loading and querying
- `src/lib/index-parser.ts` - Index format parsing
- `src/lib/fs-utils.ts` - File system operations
- `src/cli.ts` - Command routing and error handling

**Risk:** Command-line tool lacking test coverage could have undetected bugs in:
- File system interactions (accidental data loss)
- Configuration parsing (corrupted config states)
- External API integration (silent failures)
- Dependency detection (incorrect framework identification)

**Priority for Implementation:**
1. High: `config.ts` (detectProjectType, detectDependencies, readConfig)
2. High: `fs-utils.ts` (file operations with real filesystem)
3. Medium: `context7-client.ts` (with API mocking)
4. Medium: Command functions (integration tests)
5. Low: `constants.ts`, `types.ts` (static data verification)

---

*Testing analysis: 2026-02-05*
