# Phase 4: Error Handling & Validation - Research

**Researched:** 2026-02-13
**Domain:** Structured error handling, Zod v4 validation, CLI error UX, Context7 error categorization
**Confidence:** HIGH

<user_constraints>
## User Constraints (from Roadmap)

### Phase Requirements
- ERR-01: All CLI commands wrapped in try/catch with user-friendly messages
- ERR-02: Context7 errors (network, auth, rate limit) handled with fallback and clear message
- ERR-03: Config errors (parse failure, invalid schema) with fix instructions
- ERR-04: Config validated at runtime with Zod schema

### Success Criteria
1. Every CLI command catches errors and displays a readable message (no raw stack traces)
2. Context7 failures show a specific message explaining the issue and available fallback
3. Invalid or corrupted config.json displays what is wrong and how to fix it
4. Config is validated against a Zod schema at load time -- type mismatches caught before commands execute

### Existing Work (already done)
- Zod (`^4.3.6`) is already a dependency
- `PDIConfigSchema` and `FrameworkConfigSchema` already exist in `src/lib/config.ts`
- `readConfig()` already uses `safeParse()` with basic error formatting
- `cli.ts` already has try-catch on every command (but repetitive and basic)
- `Context7Result` union type in `context7-client.ts` already returns `{ success: false, error: string }`

### Claude's Discretion
- Error class hierarchy design (depth, naming)
- Error code naming convention
- Whether to use `z.prettifyError()` vs custom formatting
- Exact Context7 error category classification
</user_constraints>

## Summary

Phase 4 builds on existing infrastructure to deliver production-grade error handling. The codebase already has Zod validation and basic try-catch blocks, but three gaps remain: (1) no structured error types -- all errors are plain `Error` with string messages, (2) Context7 errors are returned as generic strings without categorization, and (3) config validation errors show raw Zod issue paths without actionable fix instructions.

The approach is conservative: introduce a small error hierarchy (`PDIError` base with `ConfigError` and `Context7Error` subclasses), enhance existing validation with user-friendly formatting, and categorize Context7 errors by type. The CLI error handler is refactored into a single function that handles each error type appropriately.

## Codebase Analysis

### Current Error Handling Patterns

**CLI layer (src/cli.ts):**
- 9 identical try-catch blocks with pattern: `console.error(chalk.red("Error:"), error instanceof Error ? error.message : error); process.exit(1);`
- No differentiation between error types
- No hints or fix instructions

**Config validation (src/lib/config.ts:100-118):**
- Uses `safeParse()` -- correct pattern
- Error formatting: `issues.map(i => i.path.join('.') + ': ' + i.message).join('; ')`
- Distinguishes "Invalid config" (Zod) from "Failed to read config" (JSON parse/IO)
- Missing: fix instructions, field-specific suggestions

**Context7 errors (src/lib/context7-client.ts):**
- Returns `Context7Result` union with `{ success: false, error: string, source: "http" | "mcp" | "none" }`
- Error strings are generic: "HTTP request failed", "No documentation found", "CONTEXT7_API_KEY not set"
- Redirect errors detected by string matching (`errorMessage.includes("library_redirected")`)
- No categorization of network vs auth vs rate limit errors

**Command errors:**
- Commands throw `new Error("PDI not initialized. Run: pdi init")` -- helpful but not structured
- `readConfig()` returns `null` (missing) or throws (invalid) -- callers check both
- `readPackageJson()` returns `null` (missing) or throws (parse error)

### Error Categories Needed

| Category | Source | Current Handling | Needed |
|----------|--------|-----------------|--------|
| Config missing | readConfig returns null | Commands throw generic Error | NotInitializedError with hint |
| Config invalid JSON | JSON.parse throws | Caught, rethrown as Error | ConfigError with parse location |
| Config schema mismatch | Zod safeParse fails | Error with joined issues | ConfigError with field-level fixes |
| Context7 no API key | getHttpClient returns null | Returns { error: "not set" } | Specific auth error with instructions |
| Context7 auth failure | HTTP 401/403 | Caught as generic error | AuthError with re-auth hint |
| Context7 network timeout | fetch timeout/ECONNREFUSED | Caught as generic error | NetworkError with retry hint |
| Context7 rate limit | HTTP 429 | Caught as generic error | RateLimitError with wait hint |
| Context7 redirect | Error includes "redirected" | Detected by string match | Structured redirect error |

## Zod v4 Error Formatting

Zod v4 (version `^4.3.6` used in this project) provides:

- `z.prettifyError(error)`: Multi-line formatted string with arrows pointing to paths
- `z.flattenError(error)`: `{ formErrors: string[], fieldErrors: { [field]: string[] } }`
- `z.treeifyError(error)`: Nested structure mirroring schema shape
- `result.error.issues[]`: Array of `{ code, path, message, expected?, received? }`

**Recommendation:** Use custom formatting based on `error.issues` for config validation. Each issue gets a line with the field path, what's wrong, and what's expected. Add contextual fix suggestions per field.

Example output:
```
Config validation failed (.claude-docs/config.json):
  - version: Expected string, got number. This field tracks the config format version.
  - project.type: Expected "backend" | "frontend" | "fullstack" | "library" | "cli", got "unknown".

Run `pdi init --force` to regenerate config, or fix the fields above manually.
```

## Error Hierarchy Design

```
PDIError (base)
  ├── code: string (e.g., "CONFIG_INVALID", "CONTEXT7_AUTH")
  ├── hint?: string (actionable fix suggestion)
  └── cause?: Error (original error for debugging)

ConfigError extends PDIError
  ├── configPath?: string
  └── validationIssues?: ZodIssue[]

Context7Error extends PDIError
  ├── category: "auth" | "network" | "rate_limit" | "redirect" | "not_found" | "unknown"
  ├── source: "http" | "mcp" | "none"
  └── fallbackAvailable?: boolean
```

## Context7 Error Classification

HTTP errors from Context7 SDK (which uses `fetch` internally):

| Error Pattern | Category | User Message |
|---------------|----------|-------------|
| `TypeError: fetch failed` / `ECONNREFUSED` | network | "Cannot reach Context7 servers. Check your internet connection." |
| `TimeoutError` / `AbortError` | network | "Context7 request timed out. The service may be temporarily slow." |
| `401` / `403` / "unauthorized" / "invalid key" | auth | "Context7 API key is invalid or expired. Run `pdi auth` to reconfigure." |
| `429` / "rate limit" / "too many requests" | rate_limit | "Context7 rate limit reached. Wait a moment and try again." |
| "library_redirected" / "redirected" | redirect | "Library ID has changed. Run `pdi add <name> --force` to update." |
| "No documentation found" | not_found | "No documentation available for this query." |
| Everything else | unknown | Original error message |

## CLI Error Handler Design

Replace 9 identical try-catch blocks with a single `handleCommandError(error)` function:

```typescript
function handleCommandError(error: unknown): never {
  if (error instanceof ConfigError) {
    // Show validation details + fix hint
  } else if (error instanceof Context7Error) {
    // Show category-specific message + fallback info
  } else if (error instanceof PDIError) {
    // Show message + hint
  } else if (error instanceof Error) {
    // Show message only (no stack trace)
  } else {
    // Unknown error type
  }
  process.exit(1);
}
```

Commands then use: `.action(async (options) => { try { await command(options); } catch (e) { handleCommandError(e); } })`

Or even simpler, wrap all command actions with a higher-order function.

## Test Strategy

- Unit tests for error classes (construction, properties, instanceof checks)
- Unit tests for config validation error formatting (various invalid configs)
- Unit tests for Context7 error classification (mock different error patterns)
- Integration tests for CLI error handler (verify output format per error type)

---

*Phase: 04-error-handling*
*Research completed: 2026-02-13*
