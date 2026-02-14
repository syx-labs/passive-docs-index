# Plan 04-02 Summary: Unified CLI Error Handler & Context7 Error Classification

**Executed:** 2026-02-13
**Duration:** ~5m
**Status:** Complete

## What Was Done

1. **Context7 error classification** (`src/lib/context7-client.ts`):
   - `classifyContext7Error()` function categorizes errors: auth, network, rate_limit, redirect, not_found, unknown
   - HTTP and MCP query catch blocks use classification for specific error messages
   - "Both failed" message improved with actionable guidance (`pdi doctor` / `pdi auth`)

2. **Unified CLI error handler** (`src/lib/error-handler.ts`):
   - `handleCommandError()` formats each error type differently:
     - `ConfigError`: "Config Error:" prefix + validation issues + fix hint
     - `NotInitializedError`: message + "pdi init" hint
     - `Context7Error`: "Context7 Error:" prefix + hint
     - `PDIError`: message + hint
     - `Error`: message only
     - Non-Error: String coercion
   - `PDI_DEBUG=1` enables stack traces
   - Single `process.exit(1)` call point

3. **CLI refactored** (`src/cli.ts`):
   - All 9 command try-catch blocks use `handleCommandError(error)` instead of inline formatting
   - No more `process.exit(1)` in cli.ts (only in error-handler.ts)
   - Old pattern `error instanceof Error ? error.message : error` completely removed

4. **Tests** (24 new tests):
   - `context7-errors.test.ts`: All 6 categories with various error patterns
   - `cli-error-handler.test.ts`: Output formatting per error type, PDI_DEBUG behavior
   - 3 existing context7-client tests updated for new error messages

## Files Modified

- `src/lib/error-handler.ts` (NEW)
- `src/lib/context7-client.ts` (classifyContext7Error + enhanced catch blocks)
- `src/cli.ts` (unified error handler)
- `src/index.ts` (export classifyContext7Error)
- `tests/unit/lib/context7-errors.test.ts` (NEW)
- `tests/unit/lib/cli-error-handler.test.ts` (NEW)
- `tests/unit/lib/context7-client.test.ts` (updated assertions)

## Decisions

- `handleCommandError` extracted to `src/lib/error-handler.ts` (not in cli.ts) to avoid test side-effect issues from top-level `await loadApiKeyFromConfig()`
- Used explicit try-catch + `handleCommandError(error)` pattern (simpler than wrapCommand HOF, preserves Commander type inference)
- Added `"failed to fetch"` pattern to network detection (case-insensitive, covers `TypeError: Failed to fetch`)
