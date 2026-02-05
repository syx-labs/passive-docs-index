# Architecture

**Analysis Date:** 2026-02-05

## Pattern Overview

**Overall:** Modular CLI tool with layered command architecture and dual-source documentation fetching system

**Key Characteristics:**
- Command-oriented architecture (8 top-level commands)
- Dual-layer documentation retrieval (HTTP/MCP with fallback strategy)
- Compressed index format that fits into CLAUDE.md (~4KB)
- Configuration-driven framework discovery and management
- Template-based code generation for documentation structure

## Layers

**CLI Layer:**
- Purpose: Parse user commands and delegate to command handlers
- Location: `src/cli.ts`
- Contains: Command definitions using Commander.js, option parsing, error handling wrappers
- Depends on: All command modules, templates, auth
- Used by: User via `pdi` CLI

**Command Layer:**
- Purpose: Execute high-level user workflows (init, add, sync, update, status, clean, generate, auth, doctor)
- Location: `src/commands/`
- Contains: 9 command modules - each handles a specific operation
- Depends on: Config, Context7, file system utils, index utilities
- Used by: CLI layer and programmatic API users via `index.ts` exports

**Service Layer:**
- Purpose: Core business logic for configuration, documentation fetching, and file management
- Location: `src/lib/`
- Contains: Config management, Context7 clients (HTTP and MCP), file I/O, template matching, index parsing
- Depends on: External packages (@upstash/context7-sdk, Commander, Chalk), Node.js built-ins
- Used by: Command layer

**Data Layer:**
- Purpose: Persistent storage and file organization
- Location: `.claude-docs/` (created in user projects)
- Contains: `config.json`, `frameworks/`, `internal/`, `CLAUDE.md` (index)
- Depends on: Nothing (target for writes)
- Used by: Service and command layers

## Data Flow

**Documentation Ingestion Flow:**

1. User runs `pdi add hono` or `pdi init` (detects dependencies)
2. Command layer reads `package.json` and identifies frameworks using `detectDependencies()`
3. For each framework, lookup template in `FRAMEWORK_TEMPLATES` (from `src/lib/templates.ts`)
4. Extract query list from template structure (e.g., "api/app.mdx" → query for Context7)
5. Query documentation via `context7-client.ts`:
   - Primary: HTTP SDK (`@upstash/context7-sdk`) if `CONTEXT7_API_KEY` set
   - Secondary: MCP via `mcp-client.ts` if running in Claude Code
   - Tertiary: Template placeholders if offline/unavailable
6. Process responses and write to `writeDocFile()` → `.claude-docs/frameworks/{name}/{category}/{file}.mdx`
7. Update config.json with framework metadata (version, file count, lastUpdate)
8. Generate compressed index via `updateClaudeMdFromConfig()` → append to CLAUDE.md between markers

**Documentation Retrieval Flow (at AI assistant runtime):**

1. Assistant reads `CLAUDE.md` and parses the PDI index section
2. Index provides immediate directory/file reference (`.claude-docs/frameworks/hono/api/app.mdx`)
3. Assistant retrieves specific file content or uses as fallback to MCP queries
4. MCP comment in CLAUDE.md includes library ID mappings for expanded queries if needed

**Synchronization Flow:**

1. `pdi sync` compares config.json frameworks vs package.json dependencies
2. Detects: new packages (add), removed packages (remove), version mismatches (update)
3. For each change, applies action (add docs, remove docs folder, re-fetch)
4. Updates config.json and regenerates CLAUDE.md index

**Status Reporting Flow:**

1. Collect framework metadata from config.json
2. Read docs directories to calculate file counts and sizes
3. Parse CLAUDE.md to get index size
4. Compare installed versions (from package.json) vs configured versions
5. Generate status report with update recommendations

## Key Abstractions

**FrameworkTemplate:**
- Purpose: Defines the structure of documentation for a framework (what files to fetch, what to query for)
- Examples: `src/lib/templates.ts` contains HONO_TEMPLATE, DRIZZLE_TEMPLATE, etc.
- Pattern: Exported as FRAMEWORK_TEMPLATES constant; templates specify categories, files, and Context7 queries for each file

**PDIConfig:**
- Purpose: Serialized configuration that persists framework list, versions, metadata
- Location: `.claude-docs/config.json`
- Pattern: Loaded into memory by `readConfig()`, modified by commands, written back via `writeConfig()`
- Tracks: framework versions, sync timestamps, MCP provider settings, file limits

**Compressed Index Format:**
- Purpose: Space-efficient representation of all documentation files for CLAUDE.md
- Pattern: Custom line-based format with pipe delimiters
  - `[Section Title]|root:path` → section header
  - `|CRITICAL:text` → critical instructions
  - `|package@version|category:{file1.mdx,file2.mdx}` → package entry with categories and files
- Location: Generated in memory, written to CLAUDE.md between `<!-- pdi:begin -->` and `<!-- pdi:end -->` markers

**Context7 Dual Client:**
- Purpose: Unified interface to fetch documentation from HTTP or MCP sources
- Examples: `src/lib/context7-client.ts` (primary, HTTP SDK), `src/lib/mcp-client.ts` (fallback, MCP CLI)
- Pattern: `context7-client.ts` wraps both and handles availability checks; priority HTTP → MCP → offline

## Entry Points

**CLI Entry:**
- Location: `src/cli.ts`
- Triggers: `pdi <command> [options]` from user shell
- Responsibilities: Parse arguments, load API key from config if available, dispatch to command handler

**Programmatic API Entry:**
- Location: `src/index.ts`
- Triggers: `import { addCommand, syncCommand, ... } from "passive-docs-index"`
- Responsibilities: Export individual command functions and utility functions for use in other Node.js programs

**npm Bin:**
- Location: `dist/cli.js` (built from `src/cli.ts`)
- Registered in `package.json`: `"bin": { "pdi": "./dist/cli.js" }`
- Triggers: `pdi` command available after global/local install

## Error Handling

**Strategy:** Command-level try-catch with chalk color-coded error output

**Patterns:**
- CLI layer catches errors and logs via `chalk.red()` to stderr
- Commands throw descriptive errors with context (file path, operation)
- Config read errors include reason (file not found, parse failure)
- Context7 queries return success/error indicators; offline mode returns null (caller handles)
- File system operations use async/await with try-catch for mkdir, writeFile failures
- MCP CLI detection handles missing mcp-cli gracefully; returns null and falls back to HTTP

## Cross-Cutting Concerns

**Logging:**
- Console-based via `chalk` for colors, `ora` spinner for long operations
- No persistent logs; output streamed to stdout/stderr
- Spinner feedback for user-facing operations (downloading docs, writing files, syncing)

**Validation:**
- Framework names validated against `hasTemplate()` before processing
- Project type detection from package.json contents (backend, frontend, fullstack, library, cli)
- Config schema enforced by TypeScript interfaces in `src/lib/types.ts`
- Index format validation via regex parsing in `index-parser.ts`

**Authentication:**
- Context7 API key sourced from `CONTEXT7_API_KEY` environment variable
- Optionally loaded from `~/.pdi/config.json` via `loadApiKeyFromConfig()` in auth command
- No persistent storage of credentials; auth command only reads/deletes from user's home config
- Commands that use Context7 HTTP handle missing key by falling back to MCP

**File Organization:**
- All project-specific docs go in `.claude-docs/` (gitignored)
- `.claude-docs/config.json` is the single source of truth for PDI state
- `.claude-docs/frameworks/{name}/{category}/*.mdx` stores framework documentation
- `.claude-docs/internal/{category}/*.mdx` stores project-specific patterns
- Index generation always reads from disk to ensure consistency

---

*Architecture analysis: 2026-02-05*
