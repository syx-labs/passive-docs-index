# Phase 4: Error Handling & Validation - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Structured error handling and Zod-based config validation for PDI v1.0. Covers: custom error type hierarchy, enhanced config validation with fix instructions, Context7 error categorization with specific messages per failure type, unified CLI error handler, and tests for all error paths. Does NOT add new CLI commands or change feature behavior -- focuses on making existing error paths user-friendly and structured.

</domain>

<decisions>
## Implementation Decisions

### Error type hierarchy
- Create a `PDIError` base class with `code` and optional `hint` properties
- `ConfigError` subclass for config-related errors (invalid JSON, schema validation, missing config)
- `Context7Error` subclass for Context7-related errors (network, auth, rate limit, redirect)
- Keep hierarchy shallow (2 levels) -- avoid over-engineering
- All errors carry actionable `hint` strings (e.g., "Run `pdi init` to regenerate config")

### Config validation enhancements
- Zod schemas already exist in config.ts -- enhance error formatting, don't rewrite
- Distinguish JSON syntax errors from Zod schema validation errors in error messages
- Include field-level fix suggestions in validation error output
- Use `z.prettifyError()` or custom issue formatting -- Claude's discretion
- Config validation already happens at load time via `readConfig()` -- keep this pattern

### Context7 error categorization
- Classify errors by pattern matching on error messages/types from fetch and SDK
- Categories: auth, network, rate_limit, redirect, not_found, unknown
- Each category gets a specific user-facing message explaining what happened and what to do
- Show fallback availability (e.g., "MCP fallback available" or "Run `pdi auth`")

### CLI error handler
- Replace 9 identical try-catch blocks in cli.ts with a single `handleCommandError` function
- Handle each error type (ConfigError, Context7Error, PDIError, generic Error) differently
- Never show raw stack traces to users (only in PDI_DEBUG mode)
- Exit codes: 1 for all errors (keep simple for now)

### Claude's Discretion
- Exact error code naming convention (e.g., "CONFIG_INVALID" vs "config.invalid")
- Whether to use `z.prettifyError()` vs custom formatting for Zod issues
- Internal implementation of error classification (regex, string matching, etc.)
- Test organization (extend existing test files vs create new ones)

</decisions>

<specifics>
## Specific Ideas

- Error hint messages should be copy-pasteable commands (e.g., "Run: pdi init --force")
- Config errors should show the config file path so users know which file to fix
- Context7 auth errors should mention both API key and MCP as options
- The `PDI_DEBUG=1` env var (already used in cli.ts) should show stack traces when set

</specifics>

<deferred>
## Deferred Ideas

- Structured logging framework (unnecessary complexity for a CLI tool)
- Error telemetry/reporting (out of scope for v1)
- i18n for error messages (English-only for v1, Portuguese README exists)

</deferred>

---

*Phase: 04-error-handling*
*Context gathered: 2026-02-13*
