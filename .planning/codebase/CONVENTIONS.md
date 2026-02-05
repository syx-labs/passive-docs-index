# Coding Conventions

**Analysis Date:** 2026-02-05

## Naming Patterns

**Files:**
- Commands: `src/commands/*.ts` (e.g., `init.ts`, `add.ts`, `status.ts`)
- Libraries: `src/lib/*.ts` (e.g., `config.ts`, `types.ts`, `fs-utils.ts`)
- Main entry: `src/cli.ts`, `src/index.ts`
- camelCase for filenames with hyphens for multi-word compounds: `context7-client.ts`, `index-parser.ts`, `fs-utils.ts`

**Functions:**
- camelCase for all functions: `getConfigPath()`, `detectProjectType()`, `listDirRecursive()`
- Async functions use `async/await`: `async function readConfig()`, `async function writeDocFile()`
- Exported utility functions start with verb: `readFile()`, `writeFile()`, `ensureDir()`, `detectDependencies()`
- Private/internal helpers: No special prefix, scoped to module

**Variables:**
- camelCase for variables: `projectRoot`, `validFrameworks`, `selectedFrameworks`, `currentSection`
- Constants in UPPER_SNAKE_CASE in `src/lib/constants.ts`: `CLAUDE_DOCS_DIR`, `CONFIG_FILE`, `FRAMEWORKS_DIR`, `PDI_BEGIN_MARKER`
- Interface properties: camelCase: `lastSync`, `autoSyncOnInstall`, `libraryId`

**Types:**
- PascalCase for interfaces: `PDIConfig`, `ProjectConfig`, `FrameworkConfig`, `FrameworkTemplate`, `IndexSection`
- PascalCase for types: `DetectedDependency`, `KnownFramework`, `StatusResult`
- Short interface names when part of namespaces: `DocFile`, `DocFileTemplate`, `IndexEntry`, `IndexCategory`

**Enums/Union Types:**
- Literal string unions for specific domains: `"backend" | "frontend" | "fullstack" | "library" | "cli"` (ProjectConfig.type)
- Priority levels: `"P0" | "P1" | "P2"` (FrameworkTemplate.priority)
- Source types: `"context7" | "template" | "manual"` (FrameworkConfig.source)

## Code Style

**Formatting:**
- Tool: Biome (`@biomejs/biome` v2.3.14)
- Config: `biome.jsonc` extending `ultracite/biome/core`

**Key Biome Settings:**
- `noBarrelFile`: off (barrel exports allowed, e.g., `src/commands/index.ts`)
- `useTopLevelRegex`: off (regex patterns allowed at any scope)
- `noExcessiveCognitiveComplexity`: off (complex logic permitted)
- `noNestedTernary`: off (nested ternaries allowed)
- `noNonNullAssertion`: off (non-null assertions permitted)
- `useAwait`: off (async patterns flexible)

**Linting:**
- Tool: Biome with extended ruleset from `ultracite`
- Run: `bun run check` (check code), `bun run fix` (auto-fix)
- VSCode: Biome set as default formatter for TypeScript, JavaScript, JSON, YAML, HTML, etc.
- Import organization: Biome auto-organizes on save via `source.organizeImports.biome`

**Line Length:**
- Generally follows Biome defaults (no explicit line length limit observed in config)
- Imports wrapped when necessary for readability

## Import Organization

**Order:**
1. Node.js built-in modules: `import { join } from "node:path";`, `import { existsSync } from "node:fs";`
2. External packages: `import chalk from "chalk";`, `import { Command } from "commander";`
3. Local imports: `import { addCommand } from "./commands/add.js";`
4. Type imports: `import type { PDIConfig, ProjectConfig } from "./lib/types.js";`

**Path Aliases:**
- Base alias: `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- Used for cross-module imports: `@/commands/*`, `@/lib/*`
- Not heavily used in current codebase; relative imports preferred for sibling modules

**Import Extensions:**
- All local imports include `.js` extension (ESM module format): `from "./commands/add.js"`
- This ensures Bun and Node.js ESM compatibility

## Error Handling

**Patterns:**
- Try-catch blocks for async operations: `try { await readFile(...) } catch (error) { ... }`
- Error messages use conditional checks: `error instanceof Error ? error.message : "Unknown error"`
- CLI commands catch errors and exit: `process.exit(1)` after logging with `chalk.red()`
- No global error handlers; errors handled at command level

**Example from `src/cli.ts`:**
```typescript
try {
  await initCommand(options);
} catch (error) {
  console.error(
    chalk.red("Error:"),
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
```

## Logging

**Framework:** `console` (native Node.js)

**Patterns:**
- Status messages: `console.log()` with `chalk` coloring
- Errors: `console.error(chalk.red("Error:"), message)`
- Progress: `ora()` spinners from `ora` package for long operations
- Dimmed/secondary info: `chalk.dim()` for less important text
- Bold/highlighted: `chalk.bold()` for section headers

**Examples from codebase:**
- `console.log(chalk.yellow("PDI already initialized..."))` - warning
- `console.log(chalk.dim("Use --force to reinitialize."))` - helper text
- `spinner.start("Creating .claude-docs/ structure...");` - progress indicator
- `spinner.succeed("Created .claude-docs/")` - completion

## Comments

**When to Comment:**
- Module-level documentation at top: `/** PDI Config Types ... */`
- Section separators in long files: `// ============================================================================`
- Complex algorithms explaining logic flow
- Non-obvious regex patterns: Explain what regex matches

**JSDoc/TSDoc:**
- Used for module headers: `/** PDI Init Command ... */`
- Not used for individual functions in most cases
- Type annotations preferred over JSDoc comments for functions

**Example from `src/index-parser.ts`:**
```typescript
/**
 * Parse the compressed index format from a string
 *
 * Format:
 * [Section Title]|root:path
 * |CRITICAL:instruction
 * |package@version|category:{file1.mdx,file2.mdx}|category2:{file3.mdx}
 */
export function parseIndex(content: string): IndexSection[] { ... }
```

## Function Design

**Size:** Functions are typically 20-60 lines; larger functions (100+ lines) in `generate.ts` and `context7-client.ts` handle complex orchestration

**Parameters:**
- Use destructuring for options: `function addCommand(frameworks: string[], options: ExtendedAddOptions)`
- Options objects preferred over multiple boolean flags
- Type-safe parameters with interfaces: `options: InitOptions`, `options: AddOptions`

**Return Values:**
- Async functions return `Promise<T>` or `Promise<void>`
- Void returns for side-effect operations: `async function writeConfig(): Promise<void>`
- Specific return types for query operations: `Promise<PDIConfig | null>`, `Promise<DetectedDependency[]>`
- No implicit returns; explicit return statements preferred

**Example function signature:**
```typescript
export async function readConfig(
  projectRoot: string
): Promise<PDIConfig | null> { ... }
```

## Module Design

**Exports:**
- Each module exports related functions and types together
- Public API via `src/index.ts` barrel export
- Commands exported from `src/commands/index.ts`
- Utilities exported from `src/lib/*` modules

**Barrel Files:**
- `src/index.ts`: Exports all public commands and utilities (140 lines)
- `src/commands/index.ts`: Exports all command functions (14 lines)
- Biome config allows barrel exports (`noBarrelFile: off`)

**Module Responsibilities:**
- `src/lib/config.ts`: Configuration file I/O and project detection
- `src/lib/types.ts`: Type definitions for entire application
- `src/lib/constants.ts`: Constants and known frameworks
- `src/lib/fs-utils.ts`: File system operations
- `src/lib/templates.ts`: Framework template management
- `src/lib/context7-client.ts`: Context7 SDK integration
- `src/lib/index-parser.ts`: Index format parsing
- `src/commands/*.ts`: Individual CLI command implementations

## Code Organization in Files

**Header Pattern:**
1. Shebang (for CLI entry point): `#!/usr/bin/env node`
2. Module-level JSDoc comment
3. Imports (organized as per Import Organization)
4. Type definitions (if module-specific)
5. Section separators for logical groups
6. Function implementations
7. Exports at bottom or inline

**Example structure from `src/lib/config.ts`:**
```typescript
/**
 * Configuration Management
 * Read/write config.json and detect project settings
 */

import { ... }

// ============================================================================
// Config File Operations
// ============================================================================

export function getConfigPath(...) { ... }
export async function readConfig(...) { ... }

// ============================================================================
// Package.json Operations
// ============================================================================

interface PackageJson { ... }
export async function readPackageJson(...) { ... }
```

## Async/Await

**Consistency:**
- All async operations use `async/await` (no Promise chains)
- Error handling with try-catch blocks
- CLI commands marked `async` when executing async functions

**Example from `src/commands/init.ts`:**
```typescript
export async function initCommand(options: InitOptions): Promise<void> {
  try {
    const packageJson = await readPackageJson(projectRoot);
    await writeConfig(projectRoot, config);
  } catch (error) {
    // handle error
  }
}
```

## Type Safety

**TypeScript Configuration:**
- `strict: true` enabled in `tsconfig.json`
- `forceConsistentCasingInFileNames: true`
- Target: ES2022
- Module system: ESNext with bundler resolution

**Type Usage:**
- All function parameters typed: `function getConfigPath(projectRoot: string): string`
- Union types for discriminated options: `source: "context7" | "template" | "manual"`
- Interface extensions for composition: `interface ExtendedAddOptions extends AddOptions { ... }`
- Generics in utility functions: Minimal usage; mostly concrete types

---

*Convention analysis: 2026-02-05*
