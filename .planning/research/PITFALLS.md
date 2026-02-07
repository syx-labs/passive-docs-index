# Domain Pitfalls: CLI Tool Maturation (v0.2 to v1.0)

**Project:** Passive Docs Index (PDI)
**Domain:** TypeScript CLI dev tool / AI documentation indexing
**Researched:** 2026-02-05
**Mode:** Pitfalls dimension for subsequent milestone planning

---

## Critical Pitfalls

Mistakes that cause rewrites, lost users, or broken releases.

### Pitfall 1: Testing an Untested Codebase by Starting with the Wrong Layer

**What goes wrong:** Teams add tests to an existing codebase by starting with E2E/integration tests or by trying to test commands directly. They immediately hit walls because the code was never designed for testability -- functions mix I/O with logic, file system operations are baked into business logic, and external API calls (Context7) cannot be isolated. Result: weeks spent writing flaky tests with massive mock setups that break on every refactor.

**Why it happens:** The instinct is to test "the thing users use" (CLI commands) first. But PDI's commands are tightly coupled to file system operations, the Context7 API, interactive prompts (via `prompts`), and terminal output (via `chalk`/`ora`). Testing these end-to-end requires mocking everything at once.

**Consequences:** Flaky tests, massive mock setups that are harder to maintain than the code they test, false confidence from tests that pass but do not actually verify behavior.

**Warning signs:**
- Test files are longer than the source files they test
- More than 50% of test code is mock setup
- Tests break when internal implementation changes (not behavior)
- Tests pass locally but fail in CI due to timing/environment differences

**Prevention:**
1. Refactor for testability BEFORE writing tests. Extract pure logic from I/O-heavy functions:
   - `detectProjectType(packageJson)` already takes data, not file path -- this pattern is good
   - `resolveLibraryId()` mixes HTTP calls with string parsing -- extract the parsing
   - `updateClaudeMdFromConfig()` reads files and writes output -- separate the index generation logic from the file I/O
2. Start with unit tests on pure functions: `cleanVersion()`, `parseIndex()`, `generateIndex()`, config detection logic
3. Add integration tests for commands only after the pure-logic layer is tested
4. Use dependency injection patterns (pass clients/fs modules as parameters) rather than mocking module internals

**Detection:** If the first PR adding tests has more lines of mock code than assertion code, the approach is wrong.

**Phase mapping:** Must be addressed in the FIRST phase (Testing Infrastructure). Do not write feature code until testability refactoring is done.

**Confidence:** HIGH -- directly observed in CONCERNS.md: silent exception swallowing, type assertions hiding errors, and tightly coupled I/O patterns in commands.

---

### Pitfall 2: Publishing a Broken npm Package on First Release

**What goes wrong:** First `npm publish` ships a package where the CLI binary does not work, type declarations are missing, or ESM imports fail for consumers. Users install, get errors, and never come back.

**Why it happens:** Multiple compounding issues:
1. The `files` field in `package.json` does not include everything needed (PDI currently lists `["dist", "templates"]` -- types may not be generated)
2. The `prepublishOnly` script runs `bun run build` but does not generate `.d.ts` files (current build uses `bun build` which does NOT emit type declarations)
3. ESM-only package (`"type": "module"`) breaks CommonJS consumers without explicit exports map
4. The `bin` field points to `./dist/cli.js` but the file may lack the `#!/usr/bin/env node` shebang after `bun build`
5. `.gitignore` excludes `dist/` but `.npmignore` does not exist -- npm uses `.gitignore` as fallback, potentially excluding built files

**Consequences:** First published version is broken. npm does not allow re-publishing the same version. After 24 hours, the broken version cannot be unpublished (only deprecated). First impression ruined.

**Warning signs:**
- `npm pack --dry-run` shows unexpected file list
- `npx passive-docs-index` fails after local install
- Running `arethetypeswrong` shows type resolution errors
- No CI step validates the package before publishing

**Prevention:**
1. Add a `prepack` or `prepublishOnly` script that runs: `bun run build && tsc --emitDeclarationOnly`
2. Use `npm pack` locally and inspect the tarball BEFORE first publish
3. Test the packed tarball: `npm pack && npm install ./passive-docs-index-*.tgz -g && pdi --help`
4. Validate with `attw` (Are The Types Wrong): `npx @arethetypeswrong/cli ./passive-docs-index-*.tgz`
5. Ensure `dist/cli.js` has the shebang line (`#!/usr/bin/env node`) -- bun build does NOT add this automatically
6. Set up the CI publish pipeline to run validation before `npm publish`
7. First publish manually (`npm publish --dry-run` then `npm publish`) to verify, THEN automate

**Detection:** Run `npm pack --dry-run` and verify: (a) dist/ files present, (b) .d.ts files present, (c) templates/ present, (d) no src/ or test files included.

**Phase mapping:** Must be validated in CI/CD phase. Add `npm pack` + install validation as a CI step before any publishing.

**Confidence:** HIGH -- verified against current `package.json` which uses `bun build` (no declaration emit) and has no `.npmignore`.

---

### Pitfall 3: Building a VS Code Extension as a Separate Codebase

**What goes wrong:** The extension is built as its own project with its own copy of PDI logic, its own config parsing, its own file reading. Now every bug fix requires changes in two places, and the CLI and extension diverge in behavior.

**Why it happens:** VS Code extensions have unique constraints (activation events, webview security, extension host lifecycle) that feel incompatible with CLI code. The temptation is to start fresh "just for the extension."

**Consequences:** Two codebases that drift apart. Extension shows different status than CLI. Config changes break one but not the other. Maintenance burden doubles.

**Warning signs:**
- Extension has its own `readConfig()` function
- Extension and CLI show different framework lists for the same project
- Bug reports say "works in CLI but not in extension" or vice versa

**Prevention:**
1. Extract a core library (`@pdi/core` or just the `src/lib/` exports) that both CLI and extension consume
2. PDI already exports a programmatic API via `src/index.ts` -- the extension should use this, not duplicate it
3. Extension-specific code should ONLY handle: VS Code API integration, webview rendering, activation events, command palette registration
4. Use `"type": "module"` carefully -- VS Code extensions traditionally use CommonJS. Either:
   - Build the extension with a bundler (esbuild/webpack) that handles ESM-to-CJS conversion
   - OR ensure the core library supports dual module format
5. Keep the extension in the same repo (monorepo) or as a workspace package

**Detection:** If the extension's `package.json` does not list `passive-docs-index` as a dependency, the architecture is wrong.

**Phase mapping:** Addressed in VS Code Extension phase. Core library extraction should happen in an earlier phase (Architecture Refactor or Testing phase).

**Confidence:** MEDIUM -- based on VS Code extension best practices and the project's existing programmatic API export pattern.

---

### Pitfall 4: Claude Code Skills That Over-Trigger or Under-Trigger

**What goes wrong:** PDI skills (like `/pdi-analyze` and `/pdi-generate`) either trigger on every conversation (wasting context budget) or never trigger automatically (requiring manual invocation that users forget).

**Why it happens:** Skill descriptions in `SKILL.md` frontmatter control when Claude loads them into context. Vague descriptions ("helps with documentation") match too broadly. Overly specific descriptions ("when the user says 'run pdi analyze'") never match natural language.

**Consequences:** Over-triggering: skills consume the 15,000 character context budget, crowding out other skills. Under-triggering: the whole point of "passive" documentation indexing is lost -- users must remember to invoke manually.

**Warning signs:**
- Running `/context` in Claude Code shows skills excluded due to character budget
- Users report "I forgot to run /pdi-analyze"
- Skills fire during unrelated coding conversations

**Prevention:**
1. Write descriptions that match INTENT, not keywords: "Analyzes project documentation index health, finds outdated entries, and suggests missing framework documentation. Use when auditing documentation coverage or after adding new dependencies." This triggers on "check my docs" and "what's missing" but not on "write a function."
2. For task skills (generate, deploy-like actions), use `disable-model-invocation: true` -- these should be manual-only
3. For reference skills (conventions, patterns), use `user-invocable: false` -- these should be Claude-invoked only
4. Keep `SKILL.md` under 500 lines; move detailed reference to supporting files
5. Test with `/context` to verify skill loading behavior
6. Set `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable if default 15,000 chars is insufficient

**Detection:** After creating skills, run `/context` and verify the skill appears in the loaded set without warnings.

**Phase mapping:** Claude Code Skills phase. Test trigger behavior as part of skill development.

**Confidence:** HIGH -- verified against official Claude Code skills documentation at code.claude.com/docs/en/skills.

---

### Pitfall 5: Hooks That Block Mid-Plan Instead of Validating at Boundaries

**What goes wrong:** PDI hooks (like `bun install` detection or pre-commit checks) are configured as `PreToolUse` hooks that block every file write. Claude gets "confused" mid-plan, producing worse results or retrying the same blocked action repeatedly.

**Why it happens:** Hook events seem intuitive -- "block bad things before they happen." But blocking an agent mid-plan disrupts its reasoning chain.

**Consequences:** Claude produces worse code, enters retry loops, or abandons its plan entirely. Users disable hooks out of frustration.

**Prevention:**
1. Use `PostToolUse` or `Stop` hooks instead of `PreToolUse` for validation -- let Claude finish its plan, then check the result
2. Use `PreToolUse` ONLY for genuinely dangerous operations (destructive commands, production deployments)
3. For PDI's use case, the right hook pattern is:
   - `Stop` hook (prompt-based or agent-based): "Check if CLAUDE.md index is up to date with package.json"
   - `PostToolUse` on `Bash` with matcher: detect `npm install` / `bun install` and suggest `pdi sync` via `additionalContext`
   - NOT: `PreToolUse` blocking writes until docs are updated
4. For git hooks (pre-commit), validate index freshness as a non-blocking warning, not a blocking error

**Detection:** If users report "Claude keeps trying to do X and getting blocked," the hook is in the wrong lifecycle position.

**Phase mapping:** Claude Code Hooks phase. Design hook architecture before implementation.

**Confidence:** HIGH -- verified against official Claude Code hooks documentation at code.claude.com/docs/en/hooks. The documentation explicitly warns: "Blocking an agent mid-plan confuses or even frustrates it."

---

## Technical Debt Patterns

Mistakes that accumulate cost over time.

### TD-1: Config Schema Validation Deferred Indefinitely

**What goes wrong:** PDI's `readConfig()` casts parsed JSON directly to `PDIConfig` with `as PDIConfig` -- no runtime validation. As the config schema evolves (new fields for monorepo support, plugin config, extension settings), old config files silently produce incorrect behavior instead of clear migration errors.

**Prevention:**
- Add Zod schema validation in the Testing phase, alongside test infrastructure
- Implement a config migration system: version field (already exists as "1.0.0") + migration functions
- Validate on read, not on write -- catch problems early
- This is specifically called out in CONCERNS.md and must not be deferred past v1.0

**Phase mapping:** Testing Infrastructure phase (validation library is a test-adjacent concern) or dedicated Config Hardening phase.

**Confidence:** HIGH -- directly verified in codebase (`src/lib/config.ts:43-50` casts without validation).

---

### TD-2: Hardcoded Values That Prevent Configuration

**What goes wrong:** Constants like `maxIndexKb: 4`, `cacheHours: 168`, concurrency limit `pLimit(5)`, and file extension `.mdx` are hardcoded. As users adopt PDI in diverse environments (large monorepos, slow networks, different doc formats), these become blockers that require code changes to adjust.

**Prevention:**
- Make limits configurable via `config.json` with sensible defaults
- Use environment variable overrides for CI/CD contexts
- Document the defaults and when users might need to change them
- Prioritize: concurrency limit and cache hours are the most likely to need user override

**Phase mapping:** Can be addressed incrementally. Start in Testing phase (easier to test configurable values) and complete before open source release.

**Confidence:** HIGH -- directly verified in codebase (`src/lib/constants.ts:53-59`, `src/commands/update.ts:182`).

---

### TD-3: Inconsistent Error Handling Patterns

**What goes wrong:** PDI has three different error handling patterns: silent catch (return empty object), console.error then continue, and throw-up-to-command-level. When tests are added, it is unclear what the "correct" behavior is for each error path. When users report bugs, errors are invisible.

**Prevention:**
- Define a project-wide error handling convention BEFORE adding tests:
  - Pure library functions: throw typed errors (never catch silently)
  - Command handlers: catch at command boundary, format for user
  - External API calls: return `Result<T, Error>` pattern or explicit null
- Add structured logging (even just `debug` level) for all catch blocks
- Document the convention in CLAUDE.md or a contributing guide

**Phase mapping:** Testing Infrastructure phase. Establish the convention, then write tests that verify error paths.

**Confidence:** HIGH -- directly verified in CONCERNS.md: 5+ instances of silent exception swallowing.

---

## Integration Gotchas

Specific to how PDI's components interact.

### IG-1: Context7 SDK Version Drift

**What goes wrong:** PDI depends on `@upstash/context7-sdk@^0.3.0` which is a pre-1.0 library. Pre-1.0 semver allows breaking changes in minor versions. A `bun update` or CI install could pull 0.4.0 with breaking API changes, silently breaking all documentation fetching.

**Prevention:**
- Pin the Context7 SDK version exactly: `"@upstash/context7-sdk": "0.3.0"` (not `^0.3.0`)
- Add integration tests that verify the SDK contract (resolve library, fetch docs, handle errors)
- Monitor the SDK's changelog/releases as part of maintenance
- Build the MCP fallback path robustly -- it is your safety net when the HTTP SDK has issues

**Phase mapping:** Testing Infrastructure phase (add SDK contract tests) and CI/CD phase (pin dependency versions).

**Confidence:** HIGH -- verified `package.json` shows `"@upstash/context7-sdk": "^0.3.0"` with caret range on a 0.x package.

---

### IG-2: Bun Build Missing Shebang and Type Declarations

**What goes wrong:** `bun build src/cli.ts --outfile dist/cli.js --target node --format esm` produces a JavaScript file without a `#!/usr/bin/env node` shebang line and without `.d.ts` type declaration files. The CLI is not executable when installed globally via npm, and TypeScript consumers get no type information.

**Prevention:**
- Add a post-build step that prepends the shebang: `echo '#!/usr/bin/env node' | cat - dist/cli.js > temp && mv temp dist/cli.js`
- OR switch to `tsup` / `tsdown` for building which handles shebangs and declarations automatically
- Run `tsc --emitDeclarationOnly --outDir dist` as a separate build step for type declarations
- Validate in CI: `head -1 dist/cli.js` should show `#!/usr/bin/env node`

**Phase mapping:** CI/CD and npm Publishing phase.

**Confidence:** HIGH -- verified by examining the build script in `package.json` which uses raw `bun build` without shebang handling.

---

### IG-3: VS Code Extension Module Format Conflict

**What goes wrong:** PDI is an ESM-only package (`"type": "module"` in package.json). VS Code's extension host historically expects CommonJS. Importing PDI's core library from an extension causes `ERR_REQUIRE_ESM` errors at runtime.

**Prevention:**
- Bundle the VS Code extension with esbuild or webpack, configured to handle ESM imports
- Use VS Code's recommended extension bundling approach (esbuild with `platform: 'node'` and `format: 'cjs'`)
- Test the extension in VS Code's Extension Development Host BEFORE release
- Consider whether PDI needs to ship a CJS build for broader compatibility (recommendation: NO for v1.0 -- ESM-only is fine for Node 18+, and the extension should bundle)

**Phase mapping:** VS Code Extension phase. Build tooling decision should be made early in that phase.

**Confidence:** MEDIUM -- based on VS Code extension documentation and ESM/CJS ecosystem research. Requires validation with actual VS Code extension scaffold.

---

### IG-4: Claude Code Hooks Environment Assumptions

**What goes wrong:** PDI ships hooks that assume specific PATH configurations, Node.js availability, or Bun availability in the user's Claude Code session. Hooks fail silently or crash when the environment does not match.

**Prevention:**
- Hooks receive `cwd` and environment in JSON input -- use these, do not assume
- Hook scripts should check for required tools (`which pdi || exit 0` -- graceful no-op if PDI not installed)
- Use `$CLAUDE_PROJECT_DIR` for project-relative paths
- Test hooks in both VS Code integrated terminal and standalone Claude Code CLI
- Provide clear error messages on stderr (exit code 2) rather than silent failures

**Phase mapping:** Claude Code Hooks phase.

**Confidence:** HIGH -- verified against hooks documentation which specifies environment variables and JSON input format.

---

## Performance Traps

### PT-1: Test Suite That Takes Minutes Instead of Seconds

**What goes wrong:** Tests mock the file system but create actual temp directories for "integration" tests. Each test creates directories, writes config files, runs commands, and cleans up. A 200-test suite takes 3+ minutes, developers stop running tests locally.

**Prevention:**
- In-memory file system abstraction for unit tests (pass fs functions as dependencies)
- Use Bun's built-in test runner which is significantly faster than Jest
- Only create real temp directories for a small number of true integration tests
- Use `bun test --preload` for mock setup rather than per-test mock configuration
- Target: full test suite under 30 seconds

**Phase mapping:** Testing Infrastructure phase. Design test architecture for speed from the start.

**Confidence:** MEDIUM -- based on testing best practices and Bun test runner documentation.

---

### PT-2: CI Pipeline That Blocks on npm Install

**What goes wrong:** CI workflow installs all dependencies on every run without caching. With `bun install`, this is fast (~2-5 seconds), but if the workflow also runs `npm install` for compatibility testing, the combined install step takes 30+ seconds.

**Prevention:**
- Cache `node_modules` and Bun's global cache in GitHub Actions
- Use `bun install --frozen-lockfile` in CI (fails if lockfile is out of date)
- Do not test npm compatibility in every CI run -- only on release branches or weekly
- Separate "fast check" (lint + typecheck + unit tests) from "full validation" (integration + publish dry-run)

**Phase mapping:** CI/CD phase.

**Confidence:** MEDIUM -- standard CI optimization, not PDI-specific.

---

## Security Mistakes

### SM-1: API Key Exposure in Published Package or CI Logs

**What goes wrong:** The `CONTEXT7_API_KEY` is stored in `~/.pdi/config.json` in plaintext. If tests or CI accidentally log this file's contents, or if a contributor's `.pdi/` directory is included in the package, the API key leaks.

**Prevention:**
- Add `~/.pdi/` to `.npmignore` and verify it is not in `npm pack` output
- Never log `process.env.CONTEXT7_API_KEY` -- mask it in any debug output
- In CI, use GitHub Secrets and `${{ secrets.CONTEXT7_API_KEY }}` -- never hardcode
- Add a test that verifies no API keys appear in test output
- Document that `.pdi/config.json` should be treated as sensitive

**Phase mapping:** CI/CD phase (GitHub Secrets setup) and Testing phase (key masking verification).

**Confidence:** HIGH -- verified that auth stores keys in plaintext (`src/commands/auth.ts`).

---

### SM-2: Hooks Executing Untrusted Code

**What goes wrong:** If PDI ships hook configurations in `.claude/settings.json` that reference scripts via relative paths, and a malicious contributor sends a PR adding a script at that path, the hook executes arbitrary code in the maintainer's Claude Code session.

**Prevention:**
- Ship hook scripts with absolute paths using `$CLAUDE_PROJECT_DIR`
- Document the security model: "hooks run with your user permissions"
- Review any PR that modifies `.claude/` directory contents
- Keep hook scripts simple and auditable (under 50 lines)
- Do NOT ship hooks that use `eval` or process stdin as executable code

**Phase mapping:** Claude Code Hooks phase. Security review before merge.

**Confidence:** HIGH -- verified against hooks documentation security section.

---

## "Looks Done But Isn't" Checklist

Things that appear complete but have hidden gaps.

### LD-1: "We have tests" (but only happy paths)

**Symptom:** 80%+ code coverage, but all tests use valid inputs.
**What's missing:** Tests for error paths -- malformed config JSON, missing `package.json`, Context7 API timeout, empty library responses, permission-denied file writes.
**Why it matters:** PDI's error handling is already inconsistent (CONCERNS.md). Tests that only cover happy paths will not catch the silent failures that already exist.
**Check:** For every test file, count assertions on error paths. Target: at least 30% of tests should verify error behavior.

### LD-2: "CI is set up" (but does not validate the package)

**Symptom:** GitHub Actions runs lint, typecheck, and tests on every push.
**What's missing:** No `npm pack` + tarball validation step. No test of the built CLI (`pdi --help` from the built artifact). No publish dry-run.
**Why it matters:** CI can pass while the publishable artifact is broken (missing shebang, missing types, missing templates).
**Check:** CI must include: `npm pack`, verify tarball contents, install from tarball, run `pdi --help`.

### LD-3: "The VS Code extension works" (but only in development host)

**Symptom:** Extension works in Extension Development Host (F5 debug).
**What's missing:** Not tested as a packaged VSIX. Not tested on Windows/Linux. Not tested with PDI installed globally vs locally.
**Why it matters:** The development host has access to source TypeScript and dev dependencies. The packaged extension does not.
**Check:** Build VSIX with `vsce package`, install it in a clean VS Code instance, verify all features work.

### LD-4: "We support monorepos" (but only tested with one layout)

**Symptom:** `pdi init` works in a Turborepo with `packages/` directory.
**What's missing:** Not tested with Nx workspaces, pnpm workspaces, yarn workspaces, or nested monorepos. Not tested when `package.json` is not at project root.
**Why it matters:** Monorepo layouts vary significantly. A single layout test creates false confidence.
**Check:** Test with at least 3 monorepo tools and verify: config discovery, framework detection per package, index generation scoping.

### LD-5: "Open source ready" (but no contributor guardrails)

**Symptom:** README exists, LICENSE file present, code is public.
**What's missing:** No CONTRIBUTING.md, no issue templates, no PR template, no code of conduct, no "good first issue" labels, no development setup instructions that a stranger can follow.
**Why it matters:** The first external contributor will either (a) ask basic questions that waste maintainer time, or (b) submit a PR that doesn't match project conventions, leading to frustrating review cycles.
**Check:** Can a developer who has never seen the codebase go from `git clone` to passing tests in under 5 minutes, using only the README and CONTRIBUTING.md?

### LD-6: "Skills are created" (but context budget is blown)

**Symptom:** Multiple PDI skills exist and each works when invoked manually.
**What's missing:** Total skill description size exceeds the 15,000 character default budget. Claude silently drops skills from context. Some skills never trigger automatically.
**Why it matters:** If the character budget is exceeded, Claude excludes skills without warning (unless user checks `/context`). The "passive" value proposition breaks.
**Check:** Run `/context` in Claude Code with all PDI skills installed and verify none are excluded.

---

## Pitfall-to-Phase Mapping

| Phase | Critical Pitfalls | Technical Debt | Integration Gotchas | "Looks Done" Traps |
|-------|------------------|---------------|--------------------|--------------------|
| Testing Infrastructure | P1 (wrong test layer), TD-1 (config validation), TD-3 (error handling) | TD-2 (hardcoded values) | IG-1 (SDK version pinning) | LD-1 (happy path only) |
| CI/CD + npm Publishing | P2 (broken first publish) | -- | IG-2 (shebang + types) | LD-2 (package validation) |
| Claude Code Skills | P4 (trigger calibration) | -- | -- | LD-6 (context budget) |
| Claude Code Hooks | P5 (mid-plan blocking) | -- | IG-4 (environment assumptions) | -- |
| VS Code Extension | P3 (separate codebase) | -- | IG-3 (ESM/CJS conflict) | LD-3 (dev host only) |
| Monorepo Support | -- | TD-2 (configurable limits) | -- | LD-4 (single layout) |
| Open Source Release | -- | -- | -- | LD-5 (contributor guardrails) |

### Phase Ordering Implications

1. **Testing Infrastructure FIRST** -- every subsequent phase depends on having tests. Refactor for testability, add unit tests, establish error handling conventions. This phase also adds config validation (Zod), which prevents config-related bugs in all later phases.

2. **CI/CD + Publishing SECOND** -- validates that the build artifact works. Must catch the shebang issue, type declaration issue, and package content issue BEFORE any public release.

3. **Skills and Hooks THIRD** -- these are PDI's differentiating value but are less risky than publishing (they can be iterated quickly). Design hook architecture to avoid the mid-plan blocking pitfall.

4. **VS Code Extension FOURTH** -- depends on a stable core library (tested in phase 1) and a working npm package (validated in phase 2). Extract the core library first.

5. **Monorepo + Plugin Support FIFTH** -- largest scope expansion. Needs tests, CI, and stable core before attempting.

6. **Open Source Release LAST** -- every previous phase must be complete. The "looks done but isn't" traps (LD-1 through LD-6) are the final quality gate.

---

## Sources

### Verified (HIGH confidence)
- PDI codebase analysis: `.planning/codebase/CONCERNS.md`, `ARCHITECTURE.md`, `TESTING.md`, `STACK.md`
- Claude Code skills documentation: https://code.claude.com/docs/en/skills
- Claude Code hooks documentation: https://code.claude.com/docs/en/hooks
- Bun test mocking documentation: https://bun.com/docs/test/mocks
- npm publishing documentation: https://docs.npmjs.com/cli/v7/commands/npm-publish/
- TypeScript publishing guide: https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html
- Node.js TypeScript package publishing: https://nodejs.org/en/learn/typescript/publishing-a-ts-package

### Cross-verified (MEDIUM confidence)
- ESM/CJS dual publishing pitfalls: https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing
- VS Code extension webview API: https://code.visualstudio.com/api/extension-guides/webview
- VS Code activation events: https://code.visualstudio.com/api/references/activation-events
- Monorepo TypeScript guide: https://medium.com/simform-engineering/the-real-world-monorepo-guide-what-they-dont-tell-you-b03e68ffe579
- Are The Types Wrong (attw): https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong
- Semantic release + GitHub Actions: https://dev.to/kouts/automated-versioning-and-package-publishing-using-github-actions-and-semantic-release-1kce

### WebSearch-only (LOW confidence -- needs validation)
- Bun test runner vs Vitest performance claims (benchmark-dependent, may vary by workload)
- VS Code extension development host vs packaged VSIX behavior differences (anecdotal reports)
- Open source contributor experience patterns (general advice, not PDI-specific)

---

*Pitfalls research: 2026-02-05*
