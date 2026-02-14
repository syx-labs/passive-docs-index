---
"passive-docs-index": minor
---

Add structured error handling and automation capabilities

**Error Handling (Phase 4):**
- Structured error hierarchy with `PDIError`, `ConfigError`, `Context7Error`, and `NotInitializedError`
- Configuration validation via Zod schemas with clear, actionable error messages
- Centralized `handleCommandError` for consistent CLI error formatting
- Context7 API error classification (rate limits, auth failures, network errors)

**Automation (Phase 5):**
- npm registry client for checking published package versions
- Freshness checking via semver comparison (local vs. registry)
- `pdi status --check` for CI exit codes and `pdi status --format json` for machine-readable output
- Postinstall hook for automatic `pdi generate` on package install
