# Codebase Structure

**Analysis Date:** 2026-02-05

## Directory Layout

```
passive-docs-index/
├── src/                      # TypeScript source code
│   ├── cli.ts               # CLI entry point (commands dispatcher)
│   ├── index.ts             # Programmatic API exports
│   ├── commands/            # Command implementations
│   │   ├── index.ts         # Command exports
│   │   ├── init.ts          # Initialize PDI in project
│   │   ├── add.ts           # Add framework documentation
│   │   ├── sync.ts          # Sync docs with package.json
│   │   ├── update.ts        # Update docs to latest versions
│   │   ├── status.ts        # Show project status
│   │   ├── clean.ts         # Remove orphan docs
│   │   ├── generate.ts      # Generate internal patterns
│   │   ├── auth.ts          # Manage API key config
│   │   └── doctor.ts        # Diagnose issues
│   └── lib/                 # Core services and utilities
│       ├── types.ts         # TypeScript type definitions
│       ├── constants.ts     # Known frameworks, defaults, paths
│       ├── config.ts        # Config file I/O and detection
│       ├── templates.ts     # Framework templates (Hono, Drizzle, etc.)
│       ├── context7.ts      # Context7 MCP integration (query generators)
│       ├── context7-client.ts # Unified HTTP/MCP client with fallback
│       ├── mcp-client.ts    # Low-level MCP CLI wrapper
│       ├── fs-utils.ts      # File system operations
│       ├── index-parser.ts  # Compressed index format parser/generator
│       └── index-utils.ts   # Shared index update logic
├── templates/               # Template files (not TypeScript)
├── dist/                    # Compiled output (generated)
│   ├── cli.js              # Compiled CLI
│   ├── index.js            # Compiled API
│   └── index.d.ts          # Type definitions
├── docs/                    # Project documentation
├── .planning/               # GSD planning artifacts
│   └── codebase/           # Generated analysis docs
├── .claude-docs/            # PDI data (example/test)
│   ├── config.json         # PDI configuration
│   ├── frameworks/         # Framework docs
│   ├── internal/           # Internal patterns
│   └── CLAUDE.md           # Index file
├── package.json             # Project manifest
├── tsconfig.json            # TypeScript configuration
├── biome.jsonc              # Code formatter/linter config
└── README.md                # Project documentation

```

## Directory Purposes

**src/:**
- Purpose: All TypeScript source code for PDI
- Contains: CLI, commands, library utilities
- Key files: `cli.ts` (entry), `index.ts` (API), `commands/` (operations), `lib/` (core logic)

**src/commands/:**
- Purpose: Individual command implementations
- Contains: One file per command (init, add, sync, update, status, clean, generate, auth, doctor)
- Key pattern: Each exports an async function like `initCommand(options)` that handles one workflow
- Dependencies: All use config.ts, fs-utils.ts, context7-client.ts
- Note: Commands are stateless; they read config, modify disk/config, and exit

**src/lib/:**
- Purpose: Core services and utilities (9 modules)
- Contains:
  - **types.ts**: All TypeScript interfaces (PDIConfig, FrameworkTemplate, IndexEntry, etc.)
  - **constants.ts**: Default config, known frameworks list, file paths, markers
  - **config.ts**: Read/write config.json, detect package.json, parse dependencies
  - **templates.ts**: Framework template definitions (HONO_TEMPLATE, DRIZZLE_TEMPLATE, etc.)
  - **context7.ts**: Query/library resolution call generators (produces JSON for MCP)
  - **context7-client.ts**: HTTP SDK client wrapper, availability checking, HTTP/MCP priority
  - **mcp-client.ts**: MCP CLI invocation via execSync, mcp-cli detection
  - **fs-utils.ts**: Recursive directory reading, file writing, size calculation
  - **index-parser.ts**: Parse/generate compressed index format, CLAUDE.md insertion
  - **index-utils.ts**: Shared logic for rebuilding indices across commands

**dist/:**
- Purpose: Compiled JavaScript output
- Contains: Generated cli.js, index.js, index.d.ts (from bun build)
- Note: Gitignored, regenerated on each build
- Entry: `package.json` `bin` points to `dist/cli.js`

**templates/:**
- Purpose: Static template files for code generation
- Contains: Any non-TypeScript templates (e.g., config.json template)
- Note: Included in npm package distribution

**docs/:**
- Purpose: Project documentation (guides, API docs)
- Contains: User-facing documentation

**tests/:**
- Purpose: Test files (297 tests, 16 files)
- Pattern: Bun test conventions (*.test.ts)
- Structure: unit/, integration/, helpers/, fixtures/

## Key File Locations

**Entry Points:**
- `src/cli.ts`: CLI entry point - defines all 8 commands using Commander
- `src/index.ts`: Programmatic API - exports command functions and utilities
- `dist/cli.js`: Compiled CLI (generated from src/cli.ts)

**Configuration:**
- `src/lib/constants.ts`: PDI defaults, framework mappings, file paths
- `package.json`: Project metadata, build scripts, dependencies
- `tsconfig.json`: TypeScript compilation settings
- `biome.jsonc`: Code formatting/linting rules

**Core Logic:**
- `src/lib/config.ts`: Config file operations, dependency detection
- `src/lib/context7-client.ts`: Documentation fetching (HTTP/MCP strategy)
- `src/lib/templates.ts`: Framework documentation templates
- `src/lib/index-parser.ts`: Compressed index format logic

**Testing:**
- `tests/unit/lib/`: Unit tests for each lib module
- `tests/integration/commands/`: Integration tests for CLI commands
- `tests/helpers/`: Mock helpers (mock-fetch.ts, mock-fs.ts, mock-mcp.ts, factories.ts, setup.ts)
- `tests/fixtures/`: Test data fixtures

## Naming Conventions

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `fs-utils.ts`, `context7-client.ts`)
- Commands: `commandName.ts` (e.g., `init.ts`, `add.ts`)
- Compiled output: `*.js` with TypeScript types `*.d.ts`
- Index files: `index.ts` in each directory (barrel files)

**Directories:**
- Module groups: `kebab-case` (e.g., `src/commands/`, `src/lib/`)
- User-facing: `.claude-docs/` (dot-prefix to avoid clutter)
- Generated: `dist/`, `.planning/` (dot-prefix conventions)

**Variables & Functions:**
- Async functions: `camelCase` with async keyword (e.g., `readConfig()`, `writeDocFile()`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `CLAUDE_DOCS_DIR`, `CONFIG_FILE`, `DEFAULT_CONFIG`)
- Types/Interfaces: `PascalCase` (e.g., `PDIConfig`, `FrameworkTemplate`)
- Private/internal: Prefix with underscore or keep in module scope (e.g., `_parseEntry()`)

**Exports:**
- Command functions: `{name}Command` (e.g., `initCommand`, `addCommand`)
- Type exports: `export type { TypeName }` in separate block
- Barrel files: Re-export from submodules

## Where to Add New Code

**New Command:**
1. Create `src/commands/mycommand.ts`
2. Export `export async function mycommandCommand(options): Promise<void>`
3. Import and register in `src/cli.ts` with `program.command("mycommand")`
4. Re-export in `src/commands/index.ts`
5. Re-export in `src/index.ts` if part of programmatic API

**New Service/Utility:**
1. Add to `src/lib/newservice.ts`
2. Export specific functions
3. Re-export from `src/lib/` index if needed
4. Commands import directly: `import { func } from "../lib/newservice.js"`

**New Framework Template:**
1. Add to `src/lib/templates.ts`
2. Export as `FRAMEWORKNAME_TEMPLATE: FrameworkTemplate`
3. Add to `FRAMEWORK_TEMPLATES` array
4. Include in `KNOWN_FRAMEWORKS` in `src/lib/constants.ts` with library ID

**New Type/Interface:**
1. Add to `src/lib/types.ts` in appropriate section
2. Use in functions with `import type { TypeName } from "./types.js"`
3. Avoid circular dependencies; types should only depend on other types

## Special Directories

**src/commands/:**
- Purpose: One file per CLI command
- Generated: No
- Committed: Yes
- Pattern: Each exports a handler function; no shared state between commands

**src/lib/:**
- Purpose: Reusable services and utilities
- Generated: No
- Committed: Yes
- Pattern: Stateless functions; modules can be used by multiple commands

**dist/:**
- Purpose: Compiled JavaScript output
- Generated: Yes (via `bun build`)
- Committed: No (.gitignore includes dist/)
- Rebuild: `npm run build` or `bun run build`

**User projects' .claude-docs/:**
- Purpose: PDI data for individual projects (not part of this repo)
- Generated: Yes (by PDI commands)
- Committed: No (.gitignore instruction added by `pdi init`)
- Contents: config.json, frameworks/, internal/, CLAUDE.md

**.planning/codebase/:**
- Purpose: GSD analysis artifacts
- Generated: Yes (by gsd:map-codebase)
- Committed: Yes
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, etc.

## Module Dependencies Graph

```
CLI (src/cli.ts)
  ├── commands/init.ts
  │   ├── config.ts
  │   ├── constants.ts
  │   ├── fs-utils.ts
  │   └── templates.ts
  ├── commands/add.ts
  │   ├── config.ts
  │   ├── context7.ts
  │   ├── context7-client.ts
  │   ├── fs-utils.ts
  │   ├── index-utils.ts
  │   └── templates.ts
  ├── commands/sync.ts
  │   ├── config.ts
  │   ├── constants.ts
  │   ├── fs-utils.ts
  │   ├── index-utils.ts
  │   ├── templates.ts
  │   └── add.ts (for framework addition)
  ├── commands/update.ts
  │   ├── config.ts
  │   ├── context7.ts
  │   ├── context7-client.ts
  │   ├── fs-utils.ts
  │   ├── index-utils.ts
  │   └── templates.ts
  ├── commands/status.ts
  │   ├── config.ts
  │   ├── fs-utils.ts
  │   └── index-parser.ts
  ├── commands/clean.ts
  │   ├── config.ts
  │   ├── fs-utils.ts
  │   └── index-utils.ts
  ├── commands/generate.ts
  │   ├── config.ts
  │   ├── context7-client.ts
  │   ├── fs-utils.ts
  │   └── index-utils.ts
  ├── commands/auth.ts
  │   └── config.ts
  ├── commands/doctor.ts
  │   ├── config.ts
  │   ├── context7-client.ts
  │   └── fs-utils.ts
  └── templates.ts

Core services:
  context7-client.ts
    ├── @upstash/context7-sdk (HTTP client)
    ├── mcp-client.ts (fallback)
    └── context7.ts (helpers)

  mcp-client.ts
    └── execSync (child_process)

  config.ts
    ├── constants.ts
    └── types.ts

  templates.ts
    └── types.ts

  index-parser.ts
    └── constants.ts

  fs-utils.ts
    ├── constants.ts
    └── types.ts

  index-utils.ts
    ├── fs-utils.ts
    ├── index-parser.ts
    └── constants.ts
```

---

*Structure analysis: 2026-02-05*
