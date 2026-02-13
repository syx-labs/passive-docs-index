---
status: resolved
trigger: "postinstall-module-not-found"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:00:15Z
---

## Current Focus

hypothesis: CONFIRMED ROOT CAUSE - postinstall script should only run for end users installing from npm (where dist/ is included), NOT during development/CI installs from source. The prepare script is the right lifecycle hook for development.
test: verified publish workflow, npm package structure, and lifecycle hooks
expecting: solution is to conditionally run postinstall only if dist/postinstall.js exists, OR use prepare hook for dev installs
next_action: implement fix using conditional check in postinstall script

## Symptoms

expected: `bun install` completes successfully including postinstall script execution
actual: Dependencies resolve and lockfile saves, but postinstall script fails with MODULE_NOT_FOUND
errors: |
  $ node ./dist/postinstall.js
  Error: Cannot find module '/home/runner/work/passive-docs-index/passive-docs-index/dist/postinstall.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
    code: 'MODULE_NOT_FOUND'
  error: postinstall script from "passive-docs-index" exited with 1
reproduction: Run `bun install` in CI (GitHub Actions). The postinstall script in package.json tries to run `node ./dist/postinstall.js` but the file doesn't exist.
timeline: Happening now in CI. Need to check if dist/postinstall.js ever existed or if there's a source file that should be compiled.

## Eliminated

## Evidence

- timestamp: 2026-02-13T00:00:00Z
  checked: package.json
  found: postinstall script references "./dist/postinstall.js", build script includes building postinstall from src/lib/postinstall.ts
  implication: postinstall.js needs to be built before it can run

- timestamp: 2026-02-13T00:00:01Z
  checked: .gitignore
  found: dist/ directory is in .gitignore (line 5)
  implication: built files are not committed to git, so they don't exist in CI checkout

- timestamp: 2026-02-13T00:00:02Z
  checked: .github/workflows/ci.yml
  found: workflow runs "bun install" first (line 34), then typecheck/test. No build step before install.
  implication: postinstall script runs before any build, so dist/postinstall.js doesn't exist yet

- timestamp: 2026-02-13T00:00:03Z
  checked: src/lib/postinstall.ts
  found: legitimate postinstall script that checks for PDI config and reports staleness
  implication: this is intended functionality, not dead code

- timestamp: 2026-02-13T00:00:04Z
  checked: .github/workflows/publish.yml and npm registry
  found: package is published to npm (v0.2.1), publish workflow runs build before publish, package.json has prepublishOnly script
  implication: for end users installing from npm, dist/ is included in tarball so postinstall works. Problem is only for dev/CI installs from source

- timestamp: 2026-02-13T00:00:05Z
  checked: npm lifecycle hooks documentation (knowledge)
  found: postinstall runs after package install (for both dev and users), prepublishOnly runs before npm publish, prepare runs after install in git dependencies
  implication: need to either skip postinstall in dev environment, or ensure dist/postinstall.js exists before it runs

## Resolution

root_cause: The postinstall script in package.json references "./dist/postinstall.js" which doesn't exist during development/CI installs from source (dist/ is gitignored). The script is intended for end users installing from npm where dist/ is included in the published tarball. During CI, bun install runs before any build step, causing MODULE_NOT_FOUND error.

fix: Add conditional check in postinstall script to gracefully skip if dist/postinstall.js doesn't exist (development environment). This allows CI to succeed while still running the postinstall hook for end users.

verification: |
  ✓ Tested bun install without dist/ directory (simulating CI): completed successfully without MODULE_NOT_FOUND error
  ✓ Tested postinstall script with dist/ present (simulating user install): executed correctly and displayed PDI message
  ✓ Both scenarios work as expected

files_changed:
  - package.json (changed postinstall script to conditionally check for dist/postinstall.js)
