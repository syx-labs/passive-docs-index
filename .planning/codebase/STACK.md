# Technology Stack

**Analysis Date:** 2026-02-05

## Languages

**Primary:**
- TypeScript 5.7.3 - All source code, strict mode enabled
- JavaScript - Generated output, CLI distribution

**Secondary:**
- YAML 2.7.0 - Configuration file parsing (`src/lib/index.ts` uses YAML for template definitions)

## Runtime

**Environment:**
- Node.js 18.0.0+ (specified in `package.json` engines)
- Bun 1.x - Primary package manager and task runner (configured in package.json scripts)
- npm - Secondary package manager (package-lock.json for npm compatibility)

**Package Manager:**
- Bun - Used for development, testing, and build (`bun run`, `bun build`, `bun test`)
- npm - Compatible, version locked in `package-lock.json`
- Lockfile: `bun.lock` (primary), `package-lock.json` (npm fallback)

## Frameworks

**Core:**
- Commander.js 13.1.0 - CLI framework for argument parsing and command routing (`src/cli.ts`)
- Context7 SDK (@upstash/context7-sdk) 0.3.0 - Primary HTTP client for documentation retrieval (`src/lib/context7-client.ts`)

**Development & Build:**
- TypeScript 5.7.3 - Type checking compiler
- Biome 2.3.14 - Code formatter and linter (configured via `biome.jsonc`)
- Ultracite 7.1.3 - Documentation validation tool (used in `check` and `fix` scripts)

**Testing:**
- Bun Test - Built-in test runner (configured in `package.json` scripts)

**Utilities:**
- Chalk 5.4.1 - Terminal color output for CLI feedback (`src/cli.ts`, `src/commands/*`)
- Ora 8.2.0 - Terminal spinners for loading indicators (`src/commands/add.ts`, `src/commands/auth.ts`, etc.)
- Prompts 2.4.2 - Interactive CLI prompts for user input (`src/commands/add.ts`, `src/commands/sync.ts`)
- p-limit 6.2.0 - Concurrency control for parallel operations (version 6 for Node 18 compatibility per commit e950ceb)
- YAML 2.7.0 - YAML parsing and serialization for configuration files

## Key Dependencies

**Critical:**
- `@upstash/context7-sdk` 0.3.0 - Provides HTTP API client for Context7 documentation service. Used in `src/lib/context7-client.ts` to fetch documentation via `client.getContext()` and `client.searchLibrary()` methods. This is the primary integration point for remote documentation fetching.

**Infrastructure:**
- `commander` 13.1.0 - CLI command building and routing. Entry point `src/cli.ts` uses this to define all commands (init, add, sync, status, clean, list, update, generate, auth, doctor).
- `p-limit` 6.2.0 - Used in `src/commands/update.ts` to parallelize documentation queries while respecting concurrency limits.

**Terminal/UI:**
- `chalk` 5.4.1 - Terminal colors for error messages, success states, and formatted output
- `ora` 8.2.0 - Spinners for loading states in commands
- `prompts` 2.4.2 - Interactive prompts for confirmations and user choices in `pdi add`, `pdi sync`, and `pdi clean`

**Data Handling:**
- `yaml` 2.7.0 - Parses and serializes YAML for config files and templates

## Configuration

**Environment:**
- Configured via `.env` file (location: `${HOME}/.pdi/config.json` for auth credentials per `src/commands/auth.ts`)
- Key environment variables:
  - `CONTEXT7_API_KEY` - API key for Context7 HTTP service (checked in `src/lib/context7-client.ts`)
  - No other standard environment variables required for basic functionality

**Build:**
- `tsconfig.json` - TypeScript compiler configuration with:
  - Target: ES2022
  - Module: ESNext
  - Strict mode enabled
  - Path aliases: `@/*` → `./src/*`
  - Output: `./dist` directory
- `biome.jsonc` - Biome formatter/linter configuration
  - Extends: `ultracite/biome/core` preset
  - Custom rules disable for performance and style flexibility
- `.prettierrc` - Not used (Biome handles formatting)
- `.eslintrc` - Not used (Biome handles linting)

## Platform Requirements

**Development:**
- Node.js 18.0.0 or higher
- Bun 1.x (recommended for development)
- Git (for version control)
- POSIX shell access (for mcp-cli detection via `which` command)

**Production/Distribution:**
- Node.js 18.0.0 or higher
- Published to npm as `passive-docs-index`
- CLI binary exposed as `pdi` command
- Requires internet connectivity for Context7 HTTP API (unless using MCP fallback)

**Optional Runtime Dependencies:**
- Claude Code with MCP CLI support - Enables fallback documentation retrieval via `plugin_context7_context7` MCP server (detected in `src/lib/mcp-client.ts`)
- mcp-cli - Standalone MCP CLI for local MCP server communication

---

*Stack analysis: 2026-02-05*
