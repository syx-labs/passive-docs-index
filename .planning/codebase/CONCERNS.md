# Codebase Concerns

**Analysis Date:** 2026-02-05

## Tech Debt

### TODO Comment on Template Existence Check

**Files:** `src/lib/config.ts:205`

**Issue:** Line 205 has a `TODO: Check if template exists` comment, indicating incomplete logic for template validation.

```typescript
hasTemplate: true, // TODO: Check if template exists
```

**Impact:** The `detectDependencies()` function always marks frameworks as having templates without validating actual existence. This could lead to false positives when frameworks are detected but their template files are missing.

**Fix approach:**
- Implement actual template existence check using `hasTemplate()` function from `templates.ts`
- Return computed value instead of hardcoded `true`

---

## Error Handling Issues

### Silent Exception Swallowing

**Files:** `src/commands/auth.ts:35-41`, `src/commands/generate.ts:215-217`, `src/commands/generate.ts:289-291`

**Issue:** Multiple catch blocks silently ignore errors with only brief comments:

```typescript
// auth.ts
} catch {
  return {};  // Silent return on any error
}

// generate.ts
} catch {
  // Invalid JSON
}

} catch {
  // Skip inaccessible directories
}
```

**Impact:** Failures are invisible to users. Failed config loads return empty objects instead of falsy values, making error states indistinguishable from "no config" states. Inaccessible directories silently vanish from results.

**Fix approach:**
- Log errors with context before catching
- Return null or error objects instead of empty containers
- Let higher-level error handlers decide what to do
- Use structured logging for debugging

---

### Unhandled Promise Rejection in Child Process Spawning

**Files:** `src/lib/mcp-client.ts:196-206`

**Issue:** The `isMcpCliAvailable()` function uses `spawn()` with race condition between multiple event handlers:

```typescript
child.on("close", (code) => {
  if (resolved) return;
  resolved = true;
  mcpCliAvailable = code === 0;
  resolve(mcpCliAvailable);
});

child.on("error", () => {
  if (resolved) return;
  resolved = true;
  mcpCliAvailable = false;
  resolve(false);
});

setTimeout(() => {
  if (resolved) return;
  resolved = true;
  child.kill();  // Kill after timeout
  mcpCliAvailable = false;
  resolve(false);
}, 5000);
```

**Impact:** The timeout-based resolution pattern is fragile. Process might not be killed cleanly. Multiple resolve calls are guarded by `resolved` flag, but timing issues could occur.

**Fix approach:**
- Use AbortController with timeout
- Ensure clean process termination
- Consider using `execFile` with timeout option instead of manual spawn management

---

### Unguarded User Input in MCP Execution

**Files:** `src/lib/mcp-client.ts:340, 368`

**Issue:** While the code has comments about security, it uses type assertions that hide potential issues:

```typescript
params as unknown as Record<string, unknown>
```

**Impact:** Type safety is bypassed. If params contain unexpected structures, they'll be serialized incorrectly to JSON.

**Fix approach:**
- Remove type assertions
- Use proper TypeScript types that don't require casting
- Validate params structure before serialization

---

## Null/Undefined Handling Issues

### Unsafe Null Coalescing with Fallback Logic

**Files:** `src/commands/update.ts:149-150`

**Issue:** Uses optional chaining with partial object creation:

```typescript
const existingConfig = config.frameworks[frameworkName] ?? ({} as Partial<FrameworkConfig>);
const version = existingConfig.version ?? template.version;
```

**Issue with update.ts:70-71:**

```typescript
const cfg = config.frameworks[fw] ?? ({} as Partial<FrameworkConfig>);
console.log(`  - ${fw}@${cfg.version ?? "unknown"} (${cfg.files ?? 0} files)`);
```

**Impact:** Empty object fallbacks mask missing frameworks. When framework doesn't exist in config, the code creates an empty placeholder instead of properly handling the absence. Properties like `version`, `files` might be undefined despite the defaults.

**Fix approach:**
- Create explicit FrameworkConfig helper functions
- Use proper null checks before fallbacks
- Distinguish between "not set" and "missing entirely"

---

### Unhandled Undefined Array Indices

**Files:** `src/lib/context7-client.ts:115`

**Issue:** Uses `.at()` with unsafe fallback:

```typescript
const libraryName = parts.at(-1) || parts.at(-2) || libraryId;
```

**Impact:** If `libraryId` is an empty string or path with no segments, the extraction fails silently. The `.at()` method returns undefined, not falsy.

**Fix approach:**
- Add explicit array length check before accessing
- Log warning when fallback is used
- Validate libraryId format at entry point

---

## File System Handling

### Synchronous File System Checks Mixed with Async

**Files:** `src/lib/fs-utils.ts:23-27, 29-33, 304-321`

**Issue:** Functions use synchronous `existsSync` before async operations:

```typescript
export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {  // Sync check
    await mkdir(dirPath, { recursive: true });  // Async operation
  }
}
```

**Issue with gitignore update:**

```typescript
export async function updateGitignore(projectRoot: string): Promise<boolean> {
  const gitignorePath = join(projectRoot, ".gitignore");
  const entry = "\n# PDI temp files\n.claude-docs/.cache/\n";

  if (!existsSync(gitignorePath)) {  // Race condition window
    await writeFile(gitignorePath, `${entry.trim()}\n`, "utf-8");
    return true;
  }

  const content = await readFile(gitignorePath, "utf-8");  // File might have been deleted
  // ...
}
```

**Impact:** Race conditions between sync check and async operation. File could be deleted/created between check and operation. gitignore update has 2-step TOCTOU (Time-of-check, Time-of-use) vulnerability.

**Fix approach:**
- Use async `access()` or `stat()` instead of `existsSync`
- Wrap write operations in try/catch to handle creation race conditions
- Use atomic operations or append-with-create flags

---

### Hardcoded File Extension Filtering

**Files:** `src/lib/fs-utils.ts:152, 224, 267`

**Issue:** Only `.mdx` files are processed, hardcoded in multiple locations:

```typescript
if (!fileName.endsWith(".mdx")) {
  continue;
}
```

**Impact:** Non-.mdx documentation would be silently ignored. If documentation format changes, code must be updated in 3+ places.

**Fix approach:**
- Define extension list as constant
- Use a file filter function
- Make format configurable in types

---

## Configuration & Constants

### Hardcoded Limits in Constants File

**Files:** `src/lib/constants.ts:53-59`

**Issue:** Resource limits are hardcoded:

```typescript
limits: {
  maxIndexKb: 4,
  maxDocsKb: 80,
  maxFilesPerFramework: 20,
}
```

**Impact:** These limits are not validated against actual constraints. No warnings when approaching limits. If limits need adjustment, entire app must be redeployed.

**Fix approach:**
- Make limits configurable via environment variables or config file
- Add validation checks during operations
- Warn users when approaching limits
- Allow per-framework overrides

---

### Hardcoded Cache Duration

**Files:** `src/lib/constants.ts:53` (cacheHours: 168)

**Issue:** One-week cache is hardcoded for all use cases

**Impact:** Cannot tune cache for different deployment scenarios. Stale documentation persists for 7 days even if upstream changes.

**Fix approach:**
- Make configurable
- Add cache invalidation endpoint
- Consider cache-control headers from Context7

---

## Process Management & Concurrency

### Hard Timeout Without Cleanup Guarantee

**Files:** `src/lib/mcp-client.ts:197-206, 295-305`

**Issue:** Uses `setTimeout` to force process termination:

```typescript
setTimeout(() => {
  if (resolved) return;
  resolved = true;
  child.kill();  // Non-graceful kill
  mcpCliAvailable = false;
  resolve(false);
}, 5000);
```

**Impact:** Process killed forcefully. Orphaned child processes possible if kill fails. No cleanup hooks.

**Fix approach:**
- Use SIGTERM with fallback to SIGKILL
- Implement resource cleanup
- Track spawned processes
- Add graceful shutdown period

---

### Hardcoded Concurrency Limit

**Files:** `src/commands/update.ts:182`

**Issue:** Parallel queries limited to 5:

```typescript
const limit = pLimit(5);
```

**Impact:** Performance is fixed regardless of system resources. No way to tune for different environments.

**Fix approach:**
- Make configurable
- Base on available system resources
- Allow CLI override

---

## Type Safety

### Type Assertions That Hide Errors

**Files:** `src/lib/mcp-client.ts:340, 368`

**Issue:** Parameters cast through `unknown`:

```typescript
params as unknown as Record<string, unknown>
```

**Impact:** Type safety completely bypassed. Invalid data structures won't be caught at compile time.

**Fix approach:**
- Use proper type definitions
- Remove assertions
- Add runtime validation

---

### Weak Type for Framework Patterns

**Files:** `src/lib/types.ts:128, src/lib/constants.ts:66-243`

**Issue:** Pattern objects stored as raw objects without strict interface:

```typescript
const KNOWN_FRAMEWORKS: KnownFramework[] = [
  {
    pattern: /^hono$/,
    name: "hono",
    displayName: "Hono",
    libraryId: "/honojs/hono",
    category: "backend",
  },
  // ... 40+ more entries
]
```

**Impact:** Large hardcoded array with no validation. If structure changes, inconsistencies hard to spot.

**Fix approach:**
- Consider using a builder pattern for frameworks
- Add validation function
- Generate from config file instead of code

---

## Security Considerations

### Process Spawn with User-Provided Paths

**Files:** `src/lib/mcp-client.ts:58-74, 85-154`

**Issue:** While comments claim no user input is passed, the function searches system paths:

```typescript
const mcpCliExe = findInPath("mcp-cli");
const claudePaths = [
  join(home, ".local/share/claude"),
  // ... hardcoded paths
];
```

**Impact:** Potential for PATH injection if `.local/bin` is world-writable. No verification of executable ownership/permissions.

**Fix approach:**
- Add permission checks (stat and verify owner)
- Use absolute paths only
- Consider using `execa` library instead of spawn
- Add logging of which executable was chosen

---

### HTTP Request Without Timeout Config

**Files:** `src/lib/context7-client.ts:159`

**Issue:** HTTP client calls Context7 API without visible timeout:

```typescript
const docs = await client.getContext(query, libraryId, { type: "json" });
```

**Impact:** If Context7 API hangs, request could block indefinitely (unless SDK has internal timeout not visible here).

**Fix approach:**
- Add explicit timeout to HTTP requests
- Verify Context7 SDK timeout behavior
- Implement request cancellation

---

## Logging & Observability

### Inconsistent Error Reporting

**Files:** Multiple command files

**Issue:** Error output is inconsistent:

```typescript
// Sometimes uses console.error
console.error(`HTTP query failed: ${httpResult.error}`);

// Sometimes just silently returns
} catch {
  return null;
}

// Sometimes logs to console
console.log(chalk.red("Error:"), error);
```

**Impact:** Hard to debug issues. Some errors are visible, others disappear. No structured logging.

**Fix approach:**
- Use consistent logging with levels (info, warn, error)
- Implement structured logging (JSON format)
- Add context to every log (timestamp, operation, user)

---

### Missing Progress Tracking for Long Operations

**Files:** `src/commands/generate.ts:280-380` (file reading loop), `src/commands/add.ts:148-200`

**Issue:** Large file operations don't provide progress feedback:

```typescript
for (const query of queries) {
  // Process query without progress reporting
}
```

**Impact:** Users can't tell if operation is working or hung. No way to estimate completion time.

**Fix approach:**
- Use progress bar library (ora has basic support)
- Report completion percentage
- Add time estimates

---

## Scalability & Performance

### Full Content Caching in Memory

**Files:** `src/commands/generate.ts:333-338`

**Issue:** Reads all file contents into memory:

```typescript
const contents = new Map<string, string>();
for (const file of files) {
  const content = await readFile(join(projectRoot, file.path), "utf-8");
  contents.set(file.path, content);
}
```

**Impact:** For large codebases, memory usage could spike. No streaming or pagination.

**Fix approach:**
- Use streaming for pattern detection
- Process files in batches
- Clear processed content from memory

---

### No Incremental Updates for Docs

**Files:** `src/commands/generate.ts`, `src/commands/update.ts`

**Issue:** Both commands regenerate/redownload all files every run

**Impact:** Slow on large projects. Bandwidth waste. Network traffic multiplied.

**Fix approach:**
- Track file hashes/timestamps
- Only update changed docs
- Implement cache validation

---

## Testing & Validation

### No Input Validation on Framework Names

**Files:** `src/commands/add.ts:69-74`

**Issue:** Framework names used directly without sanitization:

```typescript
for (const framework of selectedFrameworks) {
  if (hasTemplate(framework)) {
    validFrameworks.push(framework);
  }
}
```

**Impact:** If somehow invalid characters get through, could create problematic directory structures.

**Fix approach:**
- Add whitelist validation
- Sanitize all user input
- Use basename/normalize for paths

---

### Configuration Validation Gaps

**Files:** `src/lib/config.ts:43-50`

**Issue:** Config is parsed but not validated:

```typescript
try {
  const content = await readFile(configPath, "utf-8");
  return JSON.parse(content) as PDIConfig;
} catch (error) {
  throw new Error(`Failed to read config: ...`);
}
```

**Impact:** Invalid config structure is not checked. Missing required fields won't be caught.

**Fix approach:**
- Use schema validation library (zod, valibot)
- Validate against PDIConfig type
- Provide helpful error messages for schema violations

---

## Edge Cases & Robustness

### Empty Library ID Not Handled

**Files:** `src/lib/context7-client.ts:103-136`

**Issue:** `resolveLibraryId()` doesn't validate libraryId format:

```typescript
async function resolveLibraryId(
  client: Context7,
  libraryId: string
): Promise<string | null> {
  const parts = libraryId.split("/");
  const libraryName = parts.at(-1) || parts.at(-2) || libraryId;
  // ...
}
```

**Impact:** Empty strings, malformed IDs, or strings with no slashes could cause incorrect behavior.

**Fix approach:**
- Validate libraryId format at entry
- Add unit tests for edge cases
- Document expected format

---

### Framework Config Type Casting

**Files:** `src/commands/update.ts:149, 252-257`

**Issue:** Partial config objects created and cast:

```typescript
const existingConfig = config.frameworks[frameworkName] ?? ({} as Partial<FrameworkConfig>);
// ...
const frameworkConfig: FrameworkConfig = {
  ...existingConfig,  // Missing fields not required?
  source: "context7",
  lastUpdate: new Date().toISOString(),
  files: queries.length,
};
```

**Impact:** Type safety bypassed with `as`. Missing required fields silently created as undefined. Updates might lose data.

**Fix approach:**
- Validate complete config before using
- Use helper function to ensure all required fields
- Add runtime type guard

---

## Missing Features

### No Dry Run for Generate Command

**Files:** `src/commands/generate.ts:24-28`

**Issue:** `dryRun` option exists in interface but isn't implemented:

```typescript
export interface GenerateOptions {
  category?: string;
  dryRun?: boolean;  // Not used
  ai?: boolean;
}
```

**Impact:** Users can't preview what would be generated without modifying files.

**Fix approach:**
- Implement dryRun logic
- Print what would be done
- Don't write files in dry run mode

---

### No Config Migration/Upgrade Path

**Files:** `src/lib/types.ts:10-19`

**Issue:** PDIConfig version is hardcoded as "1.0.0" with no migration logic

**Impact:** If config format changes, existing configs break. No upgrade path for users.

**Fix approach:**
- Implement config version checking
- Add migration functions
- Test with old config versions

---

## Summary by Severity

### High Priority
- Silent exception swallowing in error handlers
- File system race conditions (TOCTOU issues)
- Type assertions hiding errors in MCP client
- Configuration validation gaps

### Medium Priority
- Process cleanup issues with child process spawning
- Hardcoded limits and cache durations
- Inconsistent null/undefined handling
- Memory usage for large codebases

### Low Priority
- Logging inconsistencies
- Missing progress tracking
- Type casting for framework configs
- Unimplemented dry run feature

---

*Concerns audit: 2026-02-05*
