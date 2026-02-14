# Phase 5: Automation - Research

**Researched:** 2026-02-13
**Domain:** Postinstall hooks, npm registry API, semver comparison, CI exit codes, CLI table formatting
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Postinstall Behavior
1. **Always show something**: Even without PDI config, show a discovery hint ("Run `pdi init` to get started"). With config, show staleness details.
2. **Detailed list format**: When stale docs are detected, show framework names with version transitions (e.g., `react (v18.2->v19.0), next (v14.1->v15.0)`).
3. **Smart check**: Postinstall actually runs freshness logic internally -- only shows message if there are real issues. Not a static reminder.
4. **Use npx/bunx**: Postinstall script uses `npx pdi status` to ensure it works even without global install. Handles the case where `pdi` isn't directly in PATH.

#### Freshness Detection
1. **npm registry as source of truth**: Checks the npm registry for the latest published version of each framework. Requires network access.
2. **Major + Minor threshold**: A doc is "stale" only if the major or minor version changed. Patch differences are ignored. (e.g., 18.2->18.3 = stale, 18.2.0->18.2.1 = ok)
3. **Timestamp-based for non-npm**: Frameworks that don't correspond to npm packages use last-sync date as proxy. Marked stale after a configurable number of days without sync.
4. **Orphaned detection**: Frameworks in PDI config that are no longer in package.json are reported as "orphaned" with a suggestion to run `pdi clean`.

#### --check Mode & CI Output
1. **Differentiated exit codes**: Each problem type gets its own exit code (e.g., exit 1 = stale, exit 2 = missing, etc.). Allows CI pipelines to react differently per problem type.
2. **Dual format with --format flag**: Default output is a human-readable table (framework, current version, indexed version, status). `--format=json` outputs structured JSON for tool integration.
3. **Orphaned = fail**: Orphaned frameworks cause a non-zero exit in --check mode. Forces the team to keep config clean by running `pdi clean` when dependencies are removed.
4. **Network required**: No offline fallback. If npm registry is unreachable, --check fails with a clear error rather than giving a potentially false "all ok" result.

#### Constraints
- Postinstall must not significantly slow down `npm install` / `bun install`
- Exit codes must be documented for CI pipeline authors
- Network requirement means CI environments need outbound HTTPS access to registry.npmjs.org

### Deferred Ideas (OUT OF SCOPE)
(none captured)
</user_constraints>

## Summary

Phase 5 requires three interconnected capabilities: postinstall hooks that notify users about stale docs, freshness checking against the npm registry, and a `--check` mode for CI integration. The research reveals that **postinstall hooks have significant cross-runtime limitations** that must be carefully designed around, **semver comparison should use the canonical `semver` library** (not hand-rolled), and **the npm registry provides a lightweight abbreviated metadata API** ideal for freshness checks.

The primary risk is the postinstall hook: npm 7+ suppresses dependency postinstall stdout by default (running scripts "in the background"), and Bun blocks dependency lifecycle scripts entirely unless the package is in `trustedDependencies` or the top-500 default trusted list. The recommended approach is to write the postinstall script to stderr (which is always visible in npm), keep it fast and non-failing, and document the Bun `trustedDependencies` setup.

**Primary recommendation:** Build freshness checking as the core module first (it's the foundation for both postinstall and --check mode), use `semver` for version comparison, raw `fetch()` against the npm registry abbreviated metadata API for version lookups, and `p-limit` (already a dependency) for parallel registry requests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `semver` | ^7.7.4 | Parse, compare, extract major/minor from version strings | The canonical semver library used by npm itself. Provides `major()`, `minor()`, `diff()`, `coerce()`, `valid()`, `parse()`. 15M+ weekly downloads. |
| `@types/semver` | ^7.7.1 | TypeScript types for semver | semver does not ship built-in TS types. @types/semver is the DefinitelyTyped package for it. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-limit` | ^6.2.0 | Concurrency limiter for parallel registry fetches | Already in project dependencies. Use to limit concurrent npm registry requests (5 parallel max). |
| `chalk` | ^5.6.2 | Terminal coloring for status output and postinstall messages | Already in project dependencies. Use for the table output and postinstall hint messages. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `semver` | `compare-versions` | Zero deps, pure TS, smaller bundle (~1KB vs ~15KB). But lacks `major()`, `minor()`, `diff()`, `coerce()` functions that PDI needs for the major+minor threshold logic. Would require hand-rolling extraction. Not worth it. |
| `semver` | Hand-rolled parsing | Version strings in the wild are messy (pre-release, build metadata, loose formats like "v2" or "2"). `semver.coerce()` handles all edge cases. Hand-rolling is the #1 pitfall in version comparison. |
| Raw `fetch()` | `package-json` (sindresorhus) | Nice API, handles registry URL resolution, auth, scoped packages. But adds a pure-ESM dependency chain. Raw `fetch()` with the abbreviated metadata API is 10 lines of code for our use case (just need dist-tags.latest). |
| Raw `fetch()` | `npm-registry-fetch` | Official npm registry client. Heavy dependency tree. Overkill for reading dist-tags from the public registry. |
| `cli-table3` | `chalk` + manual formatting | cli-table3 adds unicode table borders, column alignment, word wrapping. But PDI's output is simple enough (4-5 columns, no wrapping needed) that chalk + padEnd() is sufficient. Avoids adding another dependency. |

**Installation:**
```bash
bun add semver
bun add -d @types/semver
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── registry-client.ts   # npm registry API client (fetch latest versions)
│   ├── freshness.ts          # Freshness checking logic (compare indexed vs latest)
│   └── postinstall.ts        # Postinstall hook entry point
├── commands/
│   └── status.ts             # Enhanced with --check and --format flags
└── cli.ts                    # Updated Commander setup
```

### Pattern 1: Registry Client with Abbreviated Metadata
**What:** A thin client that fetches only the dist-tags from the npm registry using the abbreviated metadata endpoint, with parallel requests via p-limit.
**When to use:** Any time PDI needs to check what the latest published version of a framework's npm package is.
**Example:**
```typescript
// Source: npm registry API docs (https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md)
import pLimit from "p-limit";

const NPM_REGISTRY = "https://registry.npmjs.org";

interface RegistryDistTags {
  latest: string;
  [tag: string]: string;
}

interface AbbreviatedMetadata {
  name: string;
  "dist-tags": RegistryDistTags;
  modified: string;
}

export async function fetchLatestVersion(packageName: string): Promise<string | null> {
  const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName)}`;
  const response = await fetch(url, {
    headers: {
      // Abbreviated metadata -- much smaller payload, contains dist-tags
      "Accept": "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Registry request failed: ${response.status}`);
  }

  const data = (await response.json()) as AbbreviatedMetadata;
  return data["dist-tags"]?.latest ?? null;
}

export async function fetchLatestVersions(
  packageNames: string[]
): Promise<Map<string, string | null>> {
  const limit = pLimit(5);
  const results = new Map<string, string | null>();

  await Promise.all(
    packageNames.map((name) =>
      limit(async () => {
        const version = await fetchLatestVersion(name);
        results.set(name, version);
      })
    )
  );

  return results;
}
```

### Pattern 2: Freshness Checker with semver.diff()
**What:** Core freshness logic that compares indexed doc versions against latest registry versions, using `semver.diff()` to determine if the change is major/minor (stale) or just patch (ok).
**When to use:** Called by both the status command and the postinstall hook.
**Example:**
```typescript
// Source: semver docs (https://github.com/npm/node-semver)
import semver from "semver";

export type FreshnessStatus = "up-to-date" | "stale" | "missing" | "orphaned";

export interface FreshnessResult {
  framework: string;
  indexedVersion: string;
  latestVersion: string | null;
  installedVersion: string | null;
  status: FreshnessStatus;
  diffType: string | null; // "major" | "minor" | "patch" | null
}

export function checkVersionFreshness(
  indexedVersion: string,
  latestVersion: string
): { isStale: boolean; diffType: string | null } {
  // Coerce loose versions like "18.x" or "v18" into valid semver
  const indexed = semver.coerce(indexedVersion);
  const latest = semver.coerce(latestVersion);

  if (!indexed || !latest) {
    return { isStale: false, diffType: null };
  }

  const diff = semver.diff(indexed, latest);

  // Only major and minor changes count as stale
  // Patch differences are ignored per CONTEXT.md decision
  const isStale = diff === "major" || diff === "minor" ||
                  diff === "premajor" || diff === "preminor";

  return { isStale, diffType: diff };
}
```

### Pattern 3: Differentiated Exit Codes
**What:** A well-defined set of exit codes for --check mode, following Linux conventions (0 = success, 1-125 = user-defined errors, 126+ = reserved).
**When to use:** When `pdi status --check` runs in CI and needs machine-readable exit codes.
**Example:**
```typescript
// Source: Linux exit code conventions (https://tldp.org/LDP/abs/html/exitcodes.html)
// Exit codes 1-2 and 126-165 and 255 have special meanings. Use 3-125 for custom codes.

export const EXIT_CODES = {
  SUCCESS: 0,          // All docs are fresh
  STALE: 1,            // One or more docs are stale (major/minor version behind)
  MISSING: 2,          // One or more configured frameworks have no docs
  ORPHANED: 3,         // Frameworks in config not in package.json
  MIXED: 4,            // Multiple problem types detected
  NETWORK_ERROR: 5,    // Could not reach npm registry
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
```

### Pattern 4: Postinstall Script (stderr for visibility)
**What:** A lightweight script that PDI puts in its own package.json `scripts.postinstall`, which runs `npx pdi status --postinstall` (a special internal mode that prints a brief summary to stderr).
**When to use:** Automatically after `npm install` / `bun install` when PDI is a project dependency.
**Example:**
```json
// In PDI's own package.json:
{
  "scripts": {
    "postinstall": "node ./dist/postinstall.js"
  }
}
```

```typescript
// src/lib/postinstall.ts -- kept minimal and fast
// Writes to stderr because npm 7+ suppresses dependency stdout
// Must never exit non-zero (would break npm install)
async function main() {
  try {
    // Quick check: does this project have PDI config?
    const { configExists } = await import("./config.js");
    const projectRoot = process.cwd();

    if (!configExists(projectRoot)) {
      // Discovery hint
      process.stderr.write(
        "\n\x1b[36m[pdi]\x1b[0m Run `npx pdi init` to set up documentation indexing\n\n"
      );
      return;
    }

    // Run lightweight freshness check
    // ... (abbreviated -- actual implementation fetches from registry)
    // Output stale frameworks to stderr
    process.stderr.write(
      `\n\x1b[33m[pdi]\x1b[0m Stale docs detected: react (v18.2->v19.0)\n` +
      `\x1b[2m     Run \`npx pdi sync\` to update\x1b[0m\n\n`
    );
  } catch {
    // NEVER fail -- postinstall errors break npm install
    // Silently exit 0
  }
}

main();
```

### Anti-Patterns to Avoid
- **Non-zero exit in postinstall:** A non-zero exit code from postinstall **causes `npm install` to fail**. The postinstall hook must always exit 0, even on errors. Swallow all exceptions.
- **stdout in postinstall:** npm 7+ runs dependency scripts "in the background" and suppresses stdout. Write to stderr instead for guaranteed visibility.
- **Heavy work in postinstall:** The postinstall runs on every `npm install`. Keep it under 1-2 seconds. Fetch only what's needed (dist-tags via abbreviated metadata, not full package info).
- **Blocking on network in postinstall:** If the registry is unreachable, the postinstall should silently give up rather than hanging or erroring. Use a short timeout (3-5 seconds).
- **Hand-rolling semver comparison:** Version strings in the wild include prefixes (`^`, `~`, `>=`), pre-release suffixes, build metadata, and loose formats like `"2"` or `"v18.2"`. Use `semver.coerce()` to normalize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semver parsing & comparison | String splitting on "." with parseInt | `semver` (npm package) | Versions have pre-release, build metadata, loose formats. `semver.coerce("v18.2")` handles "v18.2" -> "18.2.0". `semver.diff()` correctly identifies "major" vs "minor" vs "patch" changes. |
| Version range cleaning | Regex to strip `^`, `~`, `>=` | `semver.coerce()` or existing `cleanVersion()` + `semver.valid()` | Interaction of range operators with pre-release versions is non-trivial. |
| npm registry HTTP client | Custom fetch wrapper with retries/auth | Raw `fetch()` with abbreviated metadata Accept header | The public registry needs no auth. Abbreviated metadata is tiny. But DO use the correct Accept header (`application/vnd.npm.install-v1+json`) to get the small payload. |
| Exit code management | Magic numbers scattered in code | Named constants object (`EXIT_CODES`) | CI pipeline authors need documented, stable exit codes. A central constants object prevents drift. |
| Concurrency control for parallel fetches | Manual Promise.all with slicing | `p-limit` (already a dependency) | Prevents overwhelming the registry with too many parallel requests. Already used in `update.ts`. |

**Key insight:** The `semver` library handles a shocking number of edge cases that look simple but aren't (pre-release comparison rules, loose parsing, build metadata stripping). The npm registry itself uses `semver`. Don't compete with it.

## Common Pitfalls

### Pitfall 1: Postinstall Output Invisible to Users
**What goes wrong:** You add a postinstall script with `console.log()` messages, but users never see them after `npm install`.
**Why it happens:** Since npm 7, dependency lifecycle scripts run "in the background" with stdout suppressed. Only stderr and error output are visible.
**How to avoid:** Write all postinstall messages to `process.stderr.write()` instead of `console.log()`. Use ANSI escape codes directly instead of chalk (to avoid import overhead in the postinstall hot path).
**Warning signs:** Testing with `npm install --foreground-scripts` shows output, but normal `npm install` doesn't.

### Pitfall 2: Postinstall Breaks Bun Install
**What goes wrong:** Bun users get no postinstall message, or worse, the postinstall script blocks because Bun doesn't run it.
**Why it happens:** Bun blocks dependency lifecycle scripts by default. Only the top 500 trusted packages and packages in `trustedDependencies` are allowed. PDI is almost certainly not in the top 500.
**How to avoid:** Document that Bun users need to add `"passive-docs-index"` to `trustedDependencies` in their package.json, OR rely on the user running `npx pdi status` manually. The postinstall is a nice-to-have, not a critical path.
**Warning signs:** Testing only with npm, never with Bun.

### Pitfall 3: Postinstall Causes npm install Failure
**What goes wrong:** The postinstall script throws an uncaught exception or exits with non-zero code, which causes `npm install` to fail and potentially roll back the install.
**Why it happens:** Network errors (registry unreachable), missing files, or bugs in the freshness logic.
**How to avoid:** Wrap the entire postinstall in a try-catch that always exits 0. Set a short fetch timeout (3-5 seconds). Never `process.exit(1)` from postinstall.
**Warning signs:** `npm install` fails in CI environments with no internet, or in air-gapped networks.

### Pitfall 4: Slow Postinstall Degrades npm install Performance
**What goes wrong:** The postinstall script takes 5+ seconds due to multiple sequential registry fetches, making every `npm install` noticeably slower.
**Why it happens:** Fetching versions for many frameworks sequentially, or fetching full metadata instead of abbreviated.
**How to avoid:** Use the abbreviated metadata API (`Accept: application/vnd.npm.install-v1+json`), limit parallel requests with `p-limit(5)`, set a total timeout of 5 seconds. If any fetch takes too long, abort and show nothing.
**Warning signs:** Total postinstall time exceeds 2 seconds in benchmarks.

### Pitfall 5: Exit Code Conflicts with Shell Reserved Codes
**What goes wrong:** Using exit code 126, 127, 128+, or 255 for custom error types, which conflicts with shell-reserved meanings.
**Why it happens:** Not knowing that exit codes 126+ have special meanings in POSIX shells (126 = command not executable, 127 = command not found, 128+N = killed by signal N, 255 = exit status out of range).
**How to avoid:** Use exit codes 0-5 for PDI's custom statuses. Document them clearly.
**Warning signs:** CI pipelines misinterpret PDI exit codes as "command not found" or "killed by signal".

### Pitfall 6: Loose Version Strings Cause semver.diff() to Return null
**What goes wrong:** `semver.diff("18.x", "19.0.0")` returns null because "18.x" is not valid semver.
**Why it happens:** PDI stores versions like "18.x" or "4.x" (from `getMajorVersion()`), which are semver ranges, not valid semver versions.
**How to avoid:** Always use `semver.coerce()` to normalize versions before comparison. `semver.coerce("18.x")` -> `"18.0.0"`, `semver.coerce("v19")` -> `"19.0.0"`.
**Warning signs:** Freshness checks report "up-to-date" when docs are actually stale, because `diff()` returned null on invalid input.

## Code Examples

Verified patterns from official sources:

### npm Registry Abbreviated Metadata Request
```typescript
// Source: https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md
// The abbreviated metadata format contains: name, modified, dist-tags, versions
// The dist-tags object maps tag names to semver strings: { "latest": "1.0.0" }

const response = await fetch(
  `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
  {
    headers: {
      Accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
    },
    signal: AbortSignal.timeout(5000), // 5 second timeout
  }
);

const data = await response.json();
const latestVersion: string = data["dist-tags"].latest;
```

### semver Version Comparison with Coercion
```typescript
// Source: https://github.com/npm/node-semver
import semver from "semver";

// Coerce loose versions into valid semver
semver.coerce("18.x");     // SemVer { major: 18, minor: 0, patch: 0 }
semver.coerce("v19.1");    // SemVer { major: 19, minor: 1, patch: 0 }
semver.coerce("4");         // SemVer { major: 4, minor: 0, patch: 0 }

// Extract components
semver.major("18.2.1");    // 18
semver.minor("18.2.1");    // 2

// Diff returns the type of change
semver.diff("18.0.0", "19.0.0");  // "major"
semver.diff("18.0.0", "18.3.0");  // "minor"
semver.diff("18.2.0", "18.2.1");  // "patch"
semver.diff("18.0.0", "18.0.0");  // null (same version)

// Validate before operating
semver.valid("1.2.3");             // "1.2.3"
semver.valid("not-a-version");     // null
```

### Commander.js Custom Exit Codes
```typescript
// Source: https://github.com/tj/commander.js
// Commander v13+ supports program.error() with custom exit codes

import { Command } from "commander";

const program = new Command();

program
  .command("status")
  .option("--check", "Exit with non-zero code if issues found")
  .option("--format <format>", "Output format: table or json", "table")
  .action(async (options) => {
    // ... run freshness checks ...
    if (options.check && hasIssues) {
      // process.exit() directly -- Commander does not manage this
      process.exit(exitCode);
    }
  });
```

### Postinstall Script with stderr Output
```typescript
// Postinstall uses ANSI codes directly (not chalk) to minimize import time
// Writes to stderr because npm 7+ suppresses dependency stdout

const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

function writeMessage(message: string): void {
  process.stderr.write(message);
}

function formatStaleList(staleItems: Array<{ name: string; from: string; to: string }>): string {
  const items = staleItems
    .map(({ name, from, to }) => `${name} (v${from}->v${to})`)
    .join(", ");
  return (
    `\n${YELLOW}[pdi]${RESET} Stale docs: ${items}\n` +
    `${DIM}     Run \`npx pdi sync\` to update${RESET}\n\n`
  );
}
```

### Freshness Check JSON Output (for --format=json)
```typescript
// JSON output structure for CI/tool integration
interface StatusCheckResult {
  project: string;
  timestamp: string;
  status: "ok" | "issues_found";
  exitCode: number;
  issues: Array<{
    framework: string;
    type: "stale" | "missing" | "orphaned";
    indexedVersion?: string;
    latestVersion?: string;
    installedVersion?: string;
    message: string;
  }>;
  summary: {
    total: number;
    stale: number;
    missing: number;
    orphaned: number;
    upToDate: number;
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `console.log()` in postinstall | `process.stderr.write()` in postinstall | npm 7 (2020) | stdout from dependency scripts is suppressed. stderr is always visible. |
| All dependency lifecycle scripts run | Bun blocks by default, npm considering opt-in | Bun 1.0 (2023), npm RFC #80 | Postinstall is becoming a "best effort" feature, not a guaranteed execution path. |
| Full package metadata from registry | Abbreviated metadata with Accept header | npm registry API (established) | `application/vnd.npm.install-v1+json` reduces payload from MBs to KBs. |
| `npm view <pkg> version` (subprocess) | Direct `fetch()` to registry API | Always available | Faster, no subprocess overhead, works in any JS runtime. |

**Deprecated/outdated:**
- `npm-registry-client`: Deprecated in favor of `npm-registry-fetch` or direct fetch.
- `console.log()` for postinstall messaging: Suppressed since npm 7 for dependency scripts.

## Open Questions

1. **Bun trustedDependencies UX**
   - What we know: Bun blocks PDI's postinstall by default. Users must add `"passive-docs-index"` to `trustedDependencies`.
   - What's unclear: Will PDI ever be popular enough to make the Bun default trusted list (top 500)? Should we even rely on postinstall for Bun users?
   - Recommendation: Document the Bun setup clearly. Do not make postinstall a critical feature -- it's a convenience hint. The real value is in `pdi status --check` for CI.

2. **npm --ignore-scripts prevalence**
   - What we know: Security-conscious teams set `ignore-scripts=true` in .npmrc. This blocks all postinstall scripts.
   - What's unclear: What percentage of users have this enabled? Growing trend.
   - Recommendation: Accept that postinstall won't reach all users. The `--check` mode for CI is the reliable automation path.

3. **Scoped package registry URL**
   - What we know: Scoped packages (e.g., `@tanstack/react-query`) may resolve to different registries based on .npmrc config.
   - What's unclear: Should PDI respect custom registry URLs from .npmrc?
   - Recommendation: For v1, always use `registry.npmjs.org`. Document this limitation. Custom registries can be a future enhancement.

4. **Postinstall import cost**
   - What we know: The postinstall script imports PDI modules. Cold-start import time matters for install speed.
   - What's unclear: How fast is the import chain (config.ts -> constants.ts -> etc.) when Bun/Node loads it?
   - Recommendation: Keep the postinstall entry point (`postinstall.ts`) as a separate, minimal file. Use dynamic imports to lazy-load the heavy modules only if PDI config is detected.

## Sources

### Primary (HIGH confidence)
- npm registry API docs: https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md -- Abbreviated metadata format, Accept header, dist-tags structure
- npm/node-semver: https://github.com/npm/node-semver -- `major()`, `minor()`, `diff()`, `coerce()`, `valid()`, `parse()` functions
- Bun lifecycle scripts docs: https://bun.sh/docs/pm/lifecycle -- trustedDependencies, default trusted list, root project scripts vs dependency scripts
- npm scripts docs: https://docs.npmjs.com/cli/v10/using-npm/scripts/ -- Lifecycle script execution order, postinstall behavior
- Linux exit codes: https://tldp.org/LDP/abs/html/exitcodes.html -- Reserved exit codes, POSIX conventions

### Secondary (MEDIUM confidence)
- npm/cli#3347: https://github.com/npm/cli/issues/3347 -- Confirmed: npm 7+ runs dependency postinstall in background, --foreground-scripts flag, stdout suppressed
- npm/feedback#592: https://github.com/npm/feedback/discussions/592 -- npm 7 lifecycle script changes, foreground-scripts config
- Commander.js: https://github.com/tj/commander.js -- `program.error()` with exitCode, exitOverride
- @types/semver v7.7.1: https://www.npmjs.com/package/@types/semver -- TypeScript types for semver
- sindresorhus/package-json v10: https://github.com/sindresorhus/package-json -- Considered but rejected (unnecessary dependency)

### Tertiary (LOW confidence)
- Bun root project postinstall behavior: Confirmed by web search results stating "Bun will run your project's {pre|post}install scripts at the appropriate time", but this is about the ROOT project's scripts, not dependency scripts. This distinction is critical and was verified across multiple sources.
- npm ignore-scripts prevalence: Growing trend in security-conscious teams, but no hard statistics on adoption rate.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `semver` is the canonical choice, verified via npm docs and GitHub. `@types/semver` is the only TS types package. No dependencies needed for registry client (raw fetch).
- Architecture: HIGH - Patterns are straightforward, verified against npm registry API docs and semver API.
- Pitfalls: HIGH - Postinstall output suppression verified via npm/cli#3347 (official issue). Bun trusted dependencies behavior verified via official Bun docs. Exit code conventions verified via POSIX standards.
- Postinstall cross-runtime behavior: MEDIUM - The stderr workaround for npm visibility is well-documented, but Bun blocking is a hard limitation with no workaround beyond trustedDependencies documentation.

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (semver and npm registry API are very stable; Bun's trusted dependencies behavior may evolve)
