---
phase: 03-publishing-distribution
verified: 2026-02-13T16:35:00Z
status: gaps_found
score: 4/5
re_verification: false
gaps:
  - truth: "npm publish workflow triggers on GitHub release with OIDC provenance -- provenance badge visible on npmjs.com"
    status: partial
    reason: "Workflows exist and are correctly configured, but not yet merged to main branch. Manual publish of v0.2.0 completed without provenance. OIDC setup documented but untested."
    artifacts:
      - path: ".github/workflows/publish.yml"
        issue: "Not on main branch yet -- workflow cannot trigger until merged"
      - path: ".github/workflows/release.yml"
        issue: "Not on main branch yet -- workflow cannot trigger until merged"
    missing:
      - "Merge workflows to main branch"
      - "Verify workflows trigger correctly on next version change"
      - "Verify OIDC provenance attestations appear on npmjs.com after automated publish"
human_verification:
  - test: "Verify OIDC provenance after next automated publish"
    expected: "After merging workflows to main and creating a changeset, the automated publish should produce provenance attestations visible on npmjs.com"
    why_human: "OIDC provenance requires workflows to run on main branch with proper permissions. Cannot verify until workflows are merged and triggered."
  - test: "Test complete release cycle"
    expected: "Create changeset -> merge to main -> version PR created -> merge version PR -> automated publish with provenance"
    why_human: "End-to-end workflow orchestration needs real GitHub Actions execution to verify"
---

# Phase 3: Publishing & Distribution Verification Report

**Phase Goal:** PDI is installable from npm with `npx pdi` working out of the box, with provenance and changelogs
**Verified:** 2026-02-13T16:35:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                      | Status       | Evidence                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Running `npx pdi --help` in a clean environment shows the CLI help without errors                          | ✓ VERIFIED   | Tested in clean /tmp directory -- CLI loads and displays help correctly                                                              |
| 2   | npm publish workflow triggers on GitHub release with OIDC provenance -- provenance badge visible on npmjs | ⚠️ PARTIAL   | Workflows exist and are correctly configured, but not yet on main branch. Manual v0.2.0 publish completed without provenance.       |
| 3   | Package includes type declarations (.d.ts) that IDEs can consume for the programmatic API                  | ✓ VERIFIED   | npm pack includes 46 .d.ts files covering all modules. dist/index.d.ts exists and is referenced in package.json types/exports.types |
| 4   | CHANGELOG.md is generated via Changesets with release notes for each version                               | ✓ VERIFIED   | Changesets initialized with @changesets/changelog-github. CHANGELOG.md exists with proper format.                                    |
| 5   | `npm pack --dry-run` output includes dist/ and type declarations -- no missing files                       | ✓ VERIFIED   | Verified: 51 files including all dist/ artifacts, .d.ts files, README, LICENSE. No templates/ directory.                             |

**Score:** 4/5 truths verified (1 partial)

### Required Artifacts

| Artifact                        | Expected                                                   | Status     | Details                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json`                  | Correct npm metadata (bin, types, exports, repository)    | ✓ VERIFIED | All 11 metadata checks pass: bin->./dist/cli.js, types->./dist/index.d.ts, exports.types set, engines.node >=18.0.0, OIDC-format repository.url      |
| `tsconfig.build.json`           | Declaration-only emit configuration                       | ✓ VERIFIED | Exists with emitDeclarationOnly: true, extends base tsconfig, types: [] to avoid bun-types conflicts                                                  |
| `.changeset/config.json`        | Changesets configuration with GitHub changelog           | ✓ VERIFIED | Exists with @changesets/changelog-github, access: public, baseBranch: main                                                                            |
| `dist/cli.js`                   | Executable CLI bundle with shebang                        | ✓ VERIFIED | Exists, 928KB, starts with `#!/usr/bin/env node`, referenced by package.json bin.pdi                                                                  |
| `dist/index.js`                 | Main entry point bundle                                   | ✓ VERIFIED | Exists, 855KB, referenced by package.json main and exports.import                                                                                     |
| `dist/index.d.ts`               | Type declarations for programmatic API                    | ✓ VERIFIED | Exists, 2.5KB, referenced by package.json types and exports.types                                                                                     |
| `.github/workflows/release.yml` | Changesets version PR automation                          | ⚠️ ORPHANED | Exists with correct config (changesets/action@v1, permissions, concurrency) but not on main branch yet -- cannot trigger                              |
| `.github/workflows/publish.yml` | npm publish with OIDC provenance                          | ⚠️ ORPHANED | Exists with correct config (OIDC permissions, npm upgrade, artifact verification, --provenance flag) but not on main branch yet -- cannot trigger     |
| `CHANGELOG.md`                  | Version history with release notes                        | ✓ VERIFIED | Exists with proper format, v0.2.0 entry present                                                                                                        |
| `passive-docs-index` on npm    | Published package accessible via npx                      | ✓ VERIFIED | v0.2.0 published 7 minutes ago, accessible via `npx passive-docs-index`, 51 files in tarball                                                          |

### Key Link Verification

| From                            | To                       | Via                                        | Status     | Details                                                                                                                     |
| ------------------------------- | ------------------------ | ------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                  | `tsconfig.build.json`    | build:types script                         | ✓ WIRED    | `"build:types": "tsc -p tsconfig.build.json"` present and working                                                          |
| `package.json`                  | `dist/index.d.ts`        | types field                                | ✓ WIRED    | `"types": "./dist/index.d.ts"` present, file exists after build                                                            |
| `package.json`                  | `dist/cli.js`            | bin field                                  | ✓ WIRED    | `"bin": {"pdi": "./dist/cli.js"}` present, file exists with shebang                                                        |
| `.changeset/config.json`        | `package.json`           | changeset version reads/writes version     | ✓ WIRED    | access: public set, changeset status works                                                                                  |
| `.github/workflows/release.yml` | `.changeset/config.json` | changesets/action reads changeset config   | ✓ WIRED    | changesets/action@v1 step present, will read config when workflow runs                                                      |
| `.github/workflows/publish.yml` | `package.json`           | version comparison and npm publish         | ✓ WIRED    | check-version job compares package.json vs registry, publish step runs `npm publish --provenance`                          |
| `.github/workflows/publish.yml` | `dist/`                  | bun run build before publish               | ✓ WIRED    | Build step runs `bun run build`, artifact verification checks dist/cli.js, dist/index.js, dist/index.d.ts exist and valid  |

### Requirements Coverage

| Requirement | Description                                                            | Status       | Blocking Issue                                                  |
| ----------- | ---------------------------------------------------------------------- | ------------ | --------------------------------------------------------------- |
| CICD-02     | GitHub Actions workflow for publish: npm publish with provenance      | ⚠️ PARTIAL   | Workflow exists but not on main -- needs merge                  |
| CICD-03     | npm provenance badges visible on npmjs.com                            | ✗ BLOCKED    | v0.2.0 published manually without provenance                    |
| CICD-04     | Package config correct -- engines, bin, files, exports, types         | ✓ SATISFIED  | All 11 metadata checks pass                                     |
| DIST-01     | Publication on npm with `passive-docs-index` as package name          | ✓ SATISFIED  | Published and accessible                                        |
| DIST-02     | `npx pdi` works out of the box (shebang, bin entry, dist/ included)   | ✓ SATISFIED  | Tested in clean environment -- works correctly                  |
| DIST-03     | CHANGELOG generated with release notes per version                    | ✓ SATISFIED  | Changesets initialized with GitHub changelog integration        |
| DIST-04     | Type declarations (.d.ts) included for programmatic API               | ✓ SATISFIED  | 46 .d.ts files in package, dist/index.d.ts properly referenced  |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| None | -    | -       | -        | -      |

No anti-patterns detected. Workflows are production-ready, build artifacts are substantive, no placeholders or stubs.

### Human Verification Required

#### 1. Verify OIDC provenance after next automated publish

**Test:** After merging workflows to main, create a changeset with `bunx changeset`, merge to main, merge the generated version PR, then check npmjs.com for provenance badge.

**Expected:** The publish workflow should run automatically, publish to npm with `--provenance` flag, and the package page on npmjs.com should display a provenance badge linking to the GitHub Actions build with attestations.

**Why human:** OIDC provenance requires workflows to run on main branch with proper GitHub OIDC permissions. The workflow configuration is correct (`id-token: write`, `registry-url` set, npm upgraded for OIDC support, `--provenance` flag present), but cannot be verified until workflows are merged to main and triggered by an actual version change.

#### 2. Test complete release cycle end-to-end

**Test:** Execute full release cycle:
1. Create changeset: `bunx changeset` (select patch/minor, describe change)
2. Push to main (workflows are now on main)
3. Verify `release.yml` creates "Version Packages" PR with bumped version and CHANGELOG entry
4. Merge version PR
5. Verify `publish.yml` triggers, builds artifacts, and publishes to npm
6. Check npmjs.com for new version with provenance attestations

**Expected:** Full automation from changeset creation to npm publish with provenance, zero manual intervention after initial setup.

**Why human:** End-to-end workflow orchestration requires real GitHub Actions execution with branch protections, PR creation/merge, and npm registry interaction. Cannot be simulated in verification environment.

### Gaps Summary

**Gap: Automated OIDC provenance publishing not yet operational**

The phase has achieved 4 of 5 observable truths. The workflows for automated versioning (release.yml) and OIDC-provenance publishing (publish.yml) are correctly implemented and pass all artifact/wiring checks. However, they are not yet merged to the main branch, so they cannot trigger.

The package v0.2.0 was published manually (as documented in the 03-02 PLAN checkpoint) to bootstrap the package on npmjs.com, which is required before OIDC Trusted Publishing can be configured. This manual publish did not include provenance attestations.

**What's missing:**
1. Workflows need to be merged to main branch (blocked on current feature branch merge)
2. OIDC Trusted Publishing needs to be verified working (requires workflows on main + actual publish)
3. Next version bump needs to go through automated pipeline to generate provenance attestations

**Impact:**
- Core functionality works: package is installable, CLI works, type declarations present, changesets operational
- Automation infrastructure is complete but not yet operational
- After merge to main, the next release will test the full automated pipeline with OIDC provenance

**Recommendation:**
Merge workflows to main branch, then create a patch changeset to trigger the automated release cycle and verify OIDC provenance appears on npmjs.com.

---

_Verified: 2026-02-13T16:35:00Z_
_Verifier: Claude (gsd-verifier)_
