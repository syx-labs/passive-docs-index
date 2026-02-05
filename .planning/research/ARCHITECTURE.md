# Architecture Patterns: PDI v0.3.0 Feature Integration

**Domain:** CLI dev tool / AI documentation indexing -- extending existing architecture
**Researched:** 2026-02-05
**Overall confidence:** HIGH (existing codebase well-understood; integration patterns verified via Context7 + official docs)

## System Overview

### Current Architecture (v0.2.0)

```
                        User
                         |
                    pdi <command>
                         |
                  +------+------+
                  |  CLI Layer  |  src/cli.ts (Commander.js)
                  +------+------+
                         |
              +----------+----------+
              |   Command Layer     |  src/commands/*.ts (9 commands)
              +----------+----------+
                         |
         +---------------+---------------+
         |          Service Layer        |  src/lib/*.ts (10 modules)
         |  config | context7 | fs-utils |
         |  templates | index-parser     |
         +---------------+---------------+
                         |
              +----------+----------+
              |    Data Layer       |  .claude-docs/ (config.json, frameworks/, internal/)
              +----------+----------+
                         |
              +----------+----------+
              | Programmatic API    |  src/index.ts (barrel exports)
              +---------------------+
```

### Target Architecture (v0.3.0)

```
                                 User
                    +------------+------------+
                    |            |            |
               pdi <cmd>   VS Code Ext   Claude Code
                    |            |         Skills/Hooks
                    |            |            |
              +-----+-----+  +--+---+  +-----+------+
              | CLI Layer  |  | Ext  |  | .claude/   |
              | Commander  |  | Host |  | skills/    |
              +-----+------+  +--+---+  | hooks/     |
                    |            |       +-----+------+
                    |            |             |
                    +------+-----+------+------+
                           |            |
              +------------+---+  +-----+-----------+
              | Command Layer  |  | Extension Layer  |
              | src/commands/* |  | packages/vscode/ |
              +--------+-------+  +--------+--------+
                       |                    |
              +--------+--------+-----------+
              |     Core Library (@pdi/core)        |
              | config | context7 | templates       |
              | fs-utils | index-parser | types      |
              +--------+--------+-------------------+
                       |
              +--------+--------+
              |   Data Layer    |
              | .claude-docs/   |
              +--------+--------+
                       |
              +--------+--------+
              | External APIs   |
              | Context7 HTTP   |
              | Context7 MCP    |
              +-----------------+


   +---------------------+     +-----------------------+
   |  Testing Layer      |     |  CI/CD Pipeline       |
   |  tests/ (bun test)  |     |  .github/workflows/   |
   |  unit + integration |     |  test > build > pub   |
   +---------------------+     +-----------------------+
```

## Component Boundaries

### Existing Components (no structural changes needed)

| Component | Responsibility | Current Location | Communicates With |
|-----------|---------------|------------------|-------------------|
| CLI Layer | Parse commands, dispatch to handlers | `src/cli.ts` | Command Layer |
| Command Layer | Execute user workflows (init, add, sync, etc.) | `src/commands/*.ts` | Service Layer |
| Config Service | Read/write config.json, detect dependencies | `src/lib/config.ts` | Data Layer, Types |
| Context7 Client | Unified HTTP/MCP doc fetching | `src/lib/context7-client.ts` | External APIs |
| MCP Client | Low-level MCP CLI wrapper | `src/lib/mcp-client.ts` | mcp-cli process |
| Templates | Framework template definitions | `src/lib/templates.ts` | Types |
| FS Utils | File I/O, directory operations | `src/lib/fs-utils.ts` | Data Layer |
| Index Parser | Compressed index format parsing/generation | `src/lib/index-parser.ts` | FS Utils |
| Programmatic API | Barrel exports for library consumers | `src/index.ts` | All services |

### New Components

| Component | Responsibility | Proposed Location | Communicates With |
|-----------|---------------|-------------------|-------------------|
| Test Infrastructure | Unit + integration tests | `tests/` at repo root | All service modules |
| Test Fixtures | Reusable test data factories | `tests/fixtures/` | Test files |
| VS Code Extension | Editor integration (tree view, commands) | `packages/vscode/` | Core Library via programmatic API |
| Claude Code Skills | `/pdi-analyze` and `/pdi-generate` | `.claude/skills/pdi-*/` | PDI CLI (via shell commands) |
| Claude Code Hooks | Post-install sync suggestion | `.claude/settings.json` | PDI CLI |
| CI/CD Pipeline | Test, lint, build, publish | `.github/workflows/` | GitHub Actions, npm registry |
| Plugin/Template Registry | User-defined templates, external templates | `src/lib/template-registry.ts` | Config, FS Utils |

## Recommended Project Structure Changes

### Phase 1: Testing + CI/CD (no monorepo needed)

Keep current single-package structure. Add:

```
passive-docs-index/
+-- src/                          # (unchanged)
+-- tests/                        # NEW: test files
|   +-- fixtures/                 # Test data factories
|   |   +-- configs.ts            # PDIConfig factories
|   |   +-- packages.ts           # package.json factories
|   |   +-- templates.ts          # FrameworkTemplate factories
|   +-- unit/                     # Pure function tests
|   |   +-- config.test.ts        # detectProjectType, cleanVersion, etc.
|   |   +-- templates.test.ts     # hasTemplate, getTemplate, etc.
|   |   +-- index-parser.test.ts  # parseIndex, generateIndexBlock
|   |   +-- fs-utils.test.ts      # File operations with mocked fs
|   +-- integration/              # Multi-module tests
|   |   +-- commands/             # Command workflow tests
|   |   |   +-- init.test.ts
|   |   |   +-- add.test.ts
|   |   |   +-- sync.test.ts
|   |   |   +-- status.test.ts
|   |   +-- context7/             # API integration tests
|   |       +-- client.test.ts
|   +-- helpers/                  # Shared test utilities
|       +-- mock-fs.ts            # File system mocking setup
|       +-- mock-context7.ts      # Context7 API mocking
+-- .github/                      # NEW: CI/CD
|   +-- workflows/
|       +-- ci.yml                # Test + lint + typecheck on PR
|       +-- publish.yml           # npm publish on release
+-- ...
```

**Confidence:** HIGH -- Bun test runner supports `mock.module()` for module mocking (verified via Context7). Test structure is standard.

### Phase 2: Claude Code Skills + Hooks (no monorepo needed)

Add Claude Code integration files:

```
passive-docs-index/
+-- .claude/                      # NEW: Claude Code integration
|   +-- skills/
|   |   +-- pdi-analyze/
|   |   |   +-- SKILL.md          # /pdi-analyze skill
|   |   +-- pdi-generate/
|   |   |   +-- SKILL.md          # /pdi-generate skill
|   |   +-- pdi-sync/
|   |       +-- SKILL.md          # /pdi-sync skill
|   +-- settings.json             # Hooks configuration (PostToolUse, etc.)
+-- ...
```

**Confidence:** HIGH -- Claude Code skills and hooks are well-documented (verified via official docs at code.claude.com). Skills use SKILL.md with YAML frontmatter. Hooks use settings.json with event matchers.

### Phase 3: Plugin/Template System (no monorepo needed)

Extend the existing template system:

```
passive-docs-index/
+-- src/
|   +-- lib/
|       +-- templates.ts           # (existing, becomes "built-in" templates)
|       +-- template-registry.ts   # NEW: unified registry (built-in + user)
|       +-- template-loader.ts     # NEW: load from .pdi/templates/ or npm
+-- templates/                     # (existing, static template files)
+-- ...
```

**Confidence:** MEDIUM -- Plugin architecture pattern is well-established but specific implementation for PDI template loading needs design iteration. The template system exists but is currently hardcoded arrays.

### Phase 4: VS Code Extension + Monorepo Migration

Only when VS Code extension development begins, restructure to monorepo:

```
passive-docs-index/                # Monorepo root
+-- packages/
|   +-- core/                      # @pdi/core - extracted from current src/lib/
|   |   +-- src/
|   |   |   +-- config.ts
|   |   |   +-- context7-client.ts
|   |   |   +-- templates.ts
|   |   |   +-- fs-utils.ts
|   |   |   +-- index-parser.ts
|   |   |   +-- types.ts
|   |   |   +-- index.ts
|   |   +-- package.json           # @pdi/core
|   |   +-- tsconfig.json
|   +-- cli/                       # passive-docs-index (npm package)
|   |   +-- src/
|   |   |   +-- cli.ts
|   |   |   +-- commands/
|   |   |   +-- index.ts
|   |   +-- package.json           # passive-docs-index, depends on @pdi/core
|   |   +-- tsconfig.json
|   +-- vscode/                    # @pdi/vscode-extension
|       +-- src/
|       |   +-- extension.ts       # activate/deactivate
|       |   +-- tree-view.ts       # PDI docs tree provider
|       |   +-- commands.ts        # VS Code command handlers
|       |   +-- status-bar.ts      # Status bar integration
|       +-- package.json           # VS Code extension manifest
|       +-- tsconfig.json
+-- package.json                   # Workspace root
+-- turbo.json                     # Turborepo config (optional, add later)
+-- tsconfig.base.json             # Shared TS config
```

**Confidence:** MEDIUM -- Monorepo migration is a significant refactoring step. The pattern is well-proven (verified via Turborepo Context7 docs) but the migration itself carries risk.

**Recommendation: DEFER monorepo until VS Code extension is actually being built.** The core library extraction can be done as part of that phase. Premature monorepo adds complexity without benefit. All other features (testing, CI/CD, skills, hooks, templates) work fine in the current single-package structure.

## Architectural Patterns

### Pattern 1: Service Layer Isolation for Testing

**What:** All service modules in `src/lib/` are stateless functions that accept explicit arguments. This makes them directly testable without complex setup.

**How it applies:** PDI's existing architecture already follows this pattern. Functions like `readConfig(projectRoot)`, `detectProjectType(packageJson)`, and `parseIndex(content)` take explicit inputs and return outputs. This is ideal for unit testing.

**Example test strategy:**

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";
import { detectProjectType, detectDependencies } from "../../src/lib/config.js";

describe("detectProjectType", () => {
  it("detects backend project from express dependency", () => {
    const pkg = { dependencies: { express: "^4.18.0" } };
    expect(detectProjectType(pkg)).toBe("backend");
  });
});
```

**Confidence:** HIGH -- Bun's `mock.module()` supports ESM mocking (verified via Context7).

### Pattern 2: VS Code Extension as Library Consumer

**What:** The VS Code extension should consume PDI's programmatic API (`src/index.ts`) rather than wrapping CLI commands. This avoids subprocess management, provides type safety, and enables richer integration.

**How it applies:** PDI already exports all command functions and utility functions from `src/index.ts`. The VS Code extension can import these directly:

```typescript
// packages/vscode/src/commands.ts
import { readConfig, listTemplates } from "@pdi/core";
import * as vscode from "vscode";

export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("pdi.status", async () => {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return;
      const config = await readConfig(workspaceRoot);
      // Update tree view with config data
    })
  );
}
```

**Why not subprocess:** Spawning `pdi status` from the extension adds latency, requires parsing CLI output, loses type safety, and creates dependency on the CLI being installed globally. Direct API import is faster, type-safe, and works without global installation.

**Confidence:** HIGH -- VS Code extension API supports importing npm packages directly (verified via Context7 VS Code docs). PDI's programmatic API already provides the needed surface.

### Pattern 3: Claude Code Skills as Thin Wrappers

**What:** Skills should be thin instruction wrappers that invoke the PDI CLI via shell commands, not reimplementations of CLI logic. Skills provide the "when" and "how to use"; the CLI provides the "what".

**How it applies:**

```yaml
# .claude/skills/pdi-analyze/SKILL.md
---
name: pdi-analyze
description: Analyze project documentation status and suggest improvements.
  Use when the user asks about documentation coverage, missing docs, or wants
  to understand what frameworks are documented.
allowed-tools: Bash(pdi *)
---

## PDI Documentation Analysis

Run project analysis:

1. Check current status: `pdi status`
2. Check for sync issues: `pdi sync --check`
3. Run diagnostics: `pdi doctor`

Based on the output, provide:
- Summary of documented vs undocumented frameworks
- Recommendations for which frameworks to add
- Any configuration issues found by doctor

If frameworks need to be added, suggest the specific `pdi add` command.
```

**Confidence:** HIGH -- Claude Code skills documentation (verified via official docs) confirms `allowed-tools` field and the SKILL.md format.

### Pattern 4: Hook-Based Workflow Integration

**What:** Use Claude Code hooks for deterministic, event-driven integration (e.g., suggesting `pdi sync` after package installs). Hooks run shell commands at lifecycle events; skills handle conversational/interactive workflows.

**How it applies:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/suggest-sync.sh"
          }
        ]
      }
    ]
  }
}
```

The hook script checks if the Bash command was a package install and suggests syncing:

```bash
#!/bin/bash
# .claude/hooks/suggest-sync.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check if command was a package install
if echo "$COMMAND" | grep -qE '(npm install|bun add|bun install|yarn add|pnpm add)'; then
  if [ -f ".claude-docs/config.json" ]; then
    echo "Package installed. Consider running pdi sync to update docs." >&2
  fi
fi

exit 0
```

**Confidence:** HIGH -- Hooks system is well-documented with `PostToolUse` event, `Bash` matcher, and stdin JSON format verified via official docs.

### Pattern 5: Template Registry with Resolution Priority

**What:** Extend the current hardcoded template system to support a resolution chain: user-local templates > project templates > npm-published templates > built-in templates.

**How it applies:**

```typescript
// src/lib/template-registry.ts
export interface TemplateSource {
  type: "builtin" | "project" | "user" | "npm";
  path: string;
  priority: number; // lower = higher priority
}

export async function resolveTemplate(
  frameworkName: string
): Promise<FrameworkTemplate | null> {
  // 1. Check user templates: ~/.pdi/templates/{name}.yaml
  // 2. Check project templates: .pdi/templates/{name}.yaml
  // 3. Check npm templates: require(`@pdi/template-{name}`)
  // 4. Check built-in: FRAMEWORK_TEMPLATES array
  const sources = await getTemplateSources(frameworkName);
  return sources[0]?.template ?? null;
}
```

**Confidence:** MEDIUM -- The pattern is standard but the specific YAML template format and npm loading convention need design. Built-in templates are currently TypeScript objects, not YAML files.

### Pattern 6: Monorepo with Workspace Packages

**What:** When VS Code extension is developed, use npm/bun workspaces (not Turborepo initially) for simplicity. Turborepo adds overhead justified only at scale.

**Why npm workspaces first:**
- PDI already uses Bun which supports workspaces natively
- Only 2-3 packages needed (core, cli, vscode)
- Turborepo caching benefits are minimal for a small project
- Can upgrade to Turborepo later if needed

**How it applies:**

```json
{
  "name": "pdi-monorepo",
  "private": true,
  "workspaces": ["packages/*"]
}
```

**Confidence:** MEDIUM -- Bun workspace support is documented. However, the actual migration from single-package to monorepo is a non-trivial refactoring.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Testing CLI Output Instead of Functions

**What:** Writing tests that spawn `pdi status` as a subprocess and assert on terminal output strings.

**Why bad:** Fragile (output format changes break tests), slow (subprocess overhead), no type safety, hard to mock dependencies.

**Instead:** Test command functions directly with mocked dependencies:

```typescript
// BAD: testing subprocess output
// const result = spawnSync("pdi", ["status"]).stdout.toString();

// GOOD: testing function directly
mock.module("../lib/config.js", () => ({
  readConfig: mock(async () => createTestConfig()),
}));
const status = await getStatusData(projectRoot);
expect(status.frameworks).toHaveLength(2);
```

### Anti-Pattern 2: VS Code Extension Shelling Out to CLI

**What:** The VS Code extension runs subprocess commands instead of importing PDI's programmatic API.

**Why bad:** Requires PDI CLI to be globally installed. Loses type safety. Adds latency. Makes error handling harder. Output format coupling.

**Instead:** Import from `@pdi/core` directly. The extension runs in Node.js and can use the library as a dependency.

### Anti-Pattern 3: Duplicating Logic in Claude Code Skills

**What:** Writing skill instructions that reimagine CLI logic (e.g., "read .claude-docs/config.json and parse frameworks") instead of invoking the CLI.

**Why bad:** Logic drift between CLI and skill. Skills become stale. Double maintenance burden.

**Instead:** Skills invoke the CLI: `pdi status`, `pdi sync --check`, `pdi add`. The CLI is the single source of truth for all operations.

### Anti-Pattern 4: Premature Monorepo

**What:** Converting to monorepo before the VS Code extension exists.

**Why bad:** Adds workspace configuration, build complexity, and path resolution issues. Increases CI time. Makes simple tasks (like running tests) require understanding workspaces.

**Instead:** Keep single-package until VS Code extension development actually begins. Extract `@pdi/core` only when needed.

### Anti-Pattern 5: Over-Mocking in Tests

**What:** Mocking every dependency in every test, including pure functions that are fast and deterministic.

**Why bad:** Tests don't verify real behavior. Mocks drift from real implementations. False confidence.

**Instead:** Only mock external I/O boundaries:
- **Mock:** File system operations, HTTP requests, MCP CLI calls
- **Don't mock:** `detectProjectType()`, `parseIndex()`, `cleanVersion()`, `hasTemplate()`

## Data Flow

### Testing Data Flow

```
Test Runner (bun test)
  |
  v
Test File (*.test.ts)
  |
  +--> Fixture Factory --> creates test PDIConfig, package.json, etc.
  |
  +--> mock.module() --> replaces fs-utils, context7-client for isolation
  |
  +--> Function Under Test (e.g., detectDependencies)
  |
  +--> expect() assertions
```

### VS Code Extension Data Flow

```
VS Code UI (tree view, command palette, status bar)
  |
  v
Extension Host (packages/vscode/src/extension.ts)
  |
  +--> vscode.commands.registerCommand("pdi.add", handler)
  |
  v
PDI Core Library (@pdi/core)
  |
  +--> readConfig() --> .claude-docs/config.json
  +--> addCommand() --> Context7 HTTP/MCP --> .claude-docs/frameworks/
  +--> updateClaudeMdIndex() --> CLAUDE.md
  |
  v
Extension updates UI (refreshes tree view, shows notification)
```

### Claude Code Skills Data Flow

```
User: /pdi-analyze
  |
  v
Claude Code loads SKILL.md content into context
  |
  v
Claude follows skill instructions, runs:
  +--> pdi status (via allowed Bash tool)
  +--> pdi sync --check
  +--> pdi doctor
  |
  v
Claude synthesizes CLI output into analysis
  |
  v
User sees analysis + recommendations
```

### Claude Code Hooks Data Flow

```
Claude runs: bun install some-package (via Bash tool)
  |
  v
PostToolUse hook fires (matcher: "Bash")
  |
  v
Hook script receives JSON on stdin:
  { "tool_name": "Bash", "tool_input": { "command": "bun install ..." } }
  |
  v
Script checks if command matches install pattern
  |
  v
If match: writes suggestion to stderr
  (Claude receives: "Consider running pdi sync")
```

### CI/CD Data Flow

```
Developer pushes to branch / creates PR
  |
  v
GitHub Actions triggers ci.yml:
  1. Setup Bun (oven-sh/setup-bun@v2)
  2. bun install
  3. bun run check (Biome lint)
  4. bun run typecheck (tsc --noEmit)
  5. bun test (unit + integration)
  6. bun run build
  |
  v
All pass? --> PR is green

Developer creates GitHub Release
  |
  v
GitHub Actions triggers publish.yml:
  1. Setup Bun + Node.js
  2. bun install
  3. bun test
  4. bun run build
  5. npm publish (using NPM_TOKEN secret)
```

## Integration Points

### 1. Testing Infrastructure --> Existing Code

**Touch points:** Tests import from `src/lib/*.ts` and `src/commands/*.ts` directly.

**Mocking boundaries:**

| Module | What to Mock | How |
|--------|-------------|-----|
| `fs-utils.ts` | `readFile`, `writeFile`, `mkdir`, `existsSync` | `mock.module("node:fs/promises", ...)` |
| `context7-client.ts` | HTTP SDK calls, MCP CLI calls | `mock.module("./context7-client.js", ...)` |
| `mcp-client.ts` | subprocess spawning | `mock.module("node:child_process", ...)` |
| `config.ts` | File reads for config.json | Mock via `fs-utils` mock |

**No changes needed to production code** for testing -- the existing architecture is already test-friendly due to stateless functions with explicit parameters.

### 2. VS Code Extension --> Core Library

**Touch points:** Extension imports from `@pdi/core` package (extracted from `src/lib/` + `src/commands/`).

**Required surface:**
- `readConfig(projectRoot)` -- get current state
- `statusCommand()` -- project status for tree view
- `addCommand(frameworks, options)` -- add docs from extension
- `syncCommand(options)` -- sync from extension
- `listTemplates()` -- show available templates in quick pick
- Types: `PDIConfig`, `StatusResult`, `FrameworkTemplate`

**Key constraint:** VS Code extension runs in Node.js, not Bun. The core library must remain Node 18+ compatible (it already is -- no Bun-specific APIs in `src/lib/`).

### 3. Claude Code Skills --> PDI CLI

**Touch points:** Skills invoke `pdi` CLI commands via `Bash` tool.

**Distribution:** Skills committed to `.claude/skills/` in the repo. Users who clone or install PDI get the skills automatically. Can also be distributed as a Claude Code plugin.

**Key constraint:** Skills require PDI CLI to be installed and on PATH. The skill should check availability: `which pdi` or provide fallback instructions.

### 4. Claude Code Hooks --> PDI CLI

**Touch points:** Hooks in `.claude/settings.json` run shell scripts that may invoke `pdi sync --check`.

**Distribution:** Hook configuration committed to `.claude/settings.json`. Hook scripts in `.claude/hooks/`.

**Key constraint:** Hooks are deterministic -- they always fire when the matcher matches. Must be lightweight (avoid slow operations in hooks). Heavy analysis belongs in skills, not hooks.

### 5. CI/CD Pipeline --> GitHub + npm

**Touch points:** `.github/workflows/*.yml` workflows.

**Required secrets:** `NPM_TOKEN` for npm publish.

**Key constraint:** CI must work with both Bun (for tests) and Node.js (for npm publish). Use `oven-sh/setup-bun@v2` action.

### 6. Plugin/Template System --> File System + npm

**Touch points:** `src/lib/template-registry.ts` reads from multiple locations.

**Resolution chain:**
1. `~/.pdi/templates/{name}.yaml` (user-local)
2. `.pdi/templates/{name}.yaml` (project-local)
3. `@pdi/template-{name}` (npm package)
4. Built-in `FRAMEWORK_TEMPLATES` array (hardcoded)

**Key constraint:** Template format must be well-defined and documented for external authors. Consider a JSON Schema for validation.

## Build Order (Dependency-Based)

The features have clear dependencies that determine implementation order:

```
1. Testing Infrastructure     <-- No dependencies, enables everything else
   |
2. CI/CD Pipeline            <-- Depends on tests existing
   |
3. Claude Code Skills/Hooks  <-- Independent of testing, but tests validate them
   |
4. Plugin/Template System    <-- Independent, but tests catch regressions
   |
5. VS Code Extension         <-- Depends on stable, tested core library
   |
6. Monorepo Migration        <-- Only needed for VS Code extension
```

**Rationale:**
1. **Testing first** because every subsequent feature needs test coverage. Without tests, changes to the existing codebase risk regressions.
2. **CI/CD second** because it automates the test gate, making future contributions safe.
3. **Skills/Hooks third** because they are low-risk additions (new files, no code changes) and provide immediate user value.
4. **Templates fourth** because it extends existing code (templates.ts) and benefits from test coverage.
5. **VS Code extension last** because it requires the most architectural change (monorepo migration, core extraction) and benefits from a stable, well-tested foundation.
6. **Monorepo is a byproduct** of VS Code extension development, not a standalone phase.

## Scalability Considerations

| Concern | Current (CLI only) | With VS Code Extension | With Plugin Ecosystem |
|---------|-------------------|----------------------|---------------------|
| Template count | 10 hardcoded | Same | 100+ from npm registry; need lazy loading |
| Config format | JSON, v1.0.0 | Need migration system | Need schema versioning |
| Build time | <5s (bun build) | ~15s (3 packages) | Same (plugins built separately) |
| Test suite | 0 tests | 50-100 tests, <10s | Same + plugin test helpers |
| npm package size | ~50KB | CLI: ~50KB, Core: ~30KB, VSCode: ~200KB | Same |

## Sources

- Bun test runner (mock.module, mocking): Context7 `/oven-sh/bun` -- HIGH confidence
- VS Code extension API (tree views, webviews, commands, terminal): Context7 `/microsoft/vscode-docs` -- HIGH confidence
- Claude Code skills system: Official docs at https://code.claude.com/docs/en/skills -- HIGH confidence
- Claude Code hooks system: Official docs at https://code.claude.com/docs/en/hooks-guide -- HIGH confidence
- Skill authoring best practices: Official docs at https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices -- HIGH confidence
- Turborepo monorepo patterns: Context7 `/websites/turborepo` -- HIGH confidence
- GitHub Actions with Bun: Official docs at https://bun.com/docs/guides/runtime/cicd -- HIGH confidence
- VS Code extension building guide 2026: https://abdulkadersafi.com/blog/building-vs-code-extensions-in-2026-the-complete-modern-guide -- MEDIUM confidence
- TypeScript plugin architecture patterns: https://github.com/gr2m/javascript-plugin-architecture-with-typescript-definitions -- MEDIUM confidence

---

*Architecture research: 2026-02-05*
