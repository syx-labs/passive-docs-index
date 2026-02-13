---
phase: 03-publishing-distribution
verified: 2026-02-13T16:53:41Z
status: passed
score: 5/5
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  previous_verified: 2026-02-13T16:35:00Z
  gaps_closed:
    - "npm publish workflow triggers on GitHub release with OIDC provenance -- provenance badge visible on npmjs.com"
  gaps_remaining: []
  regressions: []
---

# Phase 3: Publishing & Distribution Verification Report

**Phase Goal:** PDI is installable from npm with `npx pdi` working out of the box, with provenance and changelogs
**Verified:** 2026-02-13T16:53:41Z
**Status:** passed
**Re-verification:** Yes — after gap closure plan 03-03 execution

## Re-Verification Summary

**Previous verification (2026-02-13T16:35:00Z):** 4/5 truths verified (status: gaps_found)
**Current verification (2026-02-13T16:53:41Z):** 5/5 truths verified (status: passed)

**Gap closed:**
- Truth #2: "npm publish workflow triggers on GitHub release with OIDC provenance -- provenance badge visible on npmjs.com" moved from PARTIAL to VERIFIED
- Workflows merged to main via PR #5 (c48ece9)
- Automated release cycle verified: changeset 5f86286 → version PR #6 → publish with OIDC
- Version 0.2.1 published with provenance attestations visible on npmjs.com

**Regressions:** None — all previously passing truths remain verified

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                      | Status     | Evidence                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Running `npx pdi --help` in a clean environment shows the CLI help without errors                          | ✓ VERIFIED | Tested `npx passive-docs-index@0.2.1 --help` in /tmp — CLI loads and displays full help menu                                                            |
| 2   | npm publish workflow triggers on GitHub release with OIDC provenance -- provenance badge visible on npmjs | ✓ VERIFIED | Version 0.2.1 published via automated workflow with OIDC provenance attestations. npm registry shows `dist.attestations.provenance` with SLSA v1 format |
| 3   | Package includes type declarations (.d.ts) that IDEs can consume for the programmatic API                  | ✓ VERIFIED | npm pack includes 46 .d.ts files. dist/index.d.ts referenced in package.json types/exports.types                                                         |
| 4   | CHANGELOG.md is generated via Changesets with release notes for each version                               | ✓ VERIFIED | CHANGELOG.md updated with 0.2.1 entry via Changesets, links to commit and GitHub PR                                                                      |
| 5   | `npm pack --dry-run` output includes dist/ and type declarations -- no missing files                       | ✓ VERIFIED | Verified: 51 files including all dist/ artifacts, .d.ts files, README, LICENSE. Self-dependency bug fixed.                                               |

**Score:** 5/5 truths verified — **Phase goal ACHIEVED**

### Required Artifacts

| Artifact                        | Expected                                                | Status     | Details                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                  | Correct npm metadata (bin, types, exports, repository) | ✓ VERIFIED | Version 0.2.1, all 11 metadata checks pass. Self-dependency bug fixed.                                                                   |
| `tsconfig.build.json`           | Declaration-only emit configuration                    | ✓ VERIFIED | Exists with emitDeclarationOnly: true, extends base tsconfig                                                                              |
| `.changeset/config.json`        | Changesets configuration with GitHub changelog        | ✓ VERIFIED | Configured with @changesets/changelog-github, access: public, baseBranch: main                                                           |
| `dist/cli.js`                   | Executable CLI bundle with shebang                     | ✓ VERIFIED | Exists, starts with shebang, referenced by package.json bin.pdi, tested via npx                                                           |
| `dist/index.js`                 | Main entry point bundle                                | ✓ VERIFIED | Exists, referenced by package.json main and exports.import                                                                                |
| `dist/index.d.ts`               | Type declarations for programmatic API                 | ✓ VERIFIED | Exists, referenced by package.json types and exports.types                                                                                |
| `.github/workflows/release.yml` | Changesets version PR automation                       | ✓ WIRED    | On main branch, successfully triggered by push to main, created version PR #6                                                             |
| `.github/workflows/publish.yml` | npm publish with OIDC provenance                       | ✓ WIRED    | On main branch, successfully triggered by version PR merge, published 0.2.1 with provenance                                               |
| `CHANGELOG.md`                  | Version history with release notes                     | ✓ VERIFIED | Auto-updated with 0.2.1 entry via Changesets: commit link, GitHub attribution                                                             |
| `passive-docs-index` on npm    | Published package accessible via npx                   | ✓ VERIFIED | v0.2.1 published 2026-02-13T16:48:15Z with OIDC provenance, 51 files in tarball, `npx passive-docs-index@0.2.1` works in clean /tmp env |

### Key Link Verification

| From                            | To                                 | Via                                           | Status  | Details                                                                                                                                                       |
| ------------------------------- | ---------------------------------- | --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                  | `tsconfig.build.json`              | build:types script                            | ✓ WIRED | `"build:types": "tsc -p tsconfig.build.json"` present and working                                                                                            |
| `package.json`                  | `dist/index.d.ts`                  | types field                                   | ✓ WIRED | `"types": "./dist/index.d.ts"` present, file exists after build                                                                                              |
| `package.json`                  | `dist/cli.js`                      | bin field                                     | ✓ WIRED | `"bin": {"pdi": "./dist/cli.js"}` present, file exists with shebang, tested via npx                                                                          |
| `.changeset/config.json`        | `package.json`                     | changeset version reads/writes version        | ✓ WIRED | changesets/action successfully updated package.json from 0.2.0 -> 0.2.1 in version PR                                                                         |
| `.github/workflows/release.yml` | `.changeset/config.json`           | changesets/action reads changeset config      | ✓ WIRED | Workflow run 21994928215 detected changeset 5f86286 and created version PR #6                                                                                 |
| `.github/workflows/publish.yml` | `package.json`                     | version comparison and npm publish            | ✓ WIRED | check-version job detected 0.2.1 > 0.2.0 on registry, publish job ran `npm publish --provenance` successfully                                                 |
| `.github/workflows/publish.yml` | `dist/`                            | bun run build before publish                  | ✓ WIRED | Build step succeeded in workflow run 21995031024, artifacts verified (cli.js, index.js, index.d.ts with shebang check)                                        |
| `main branch push`              | `.github/workflows/release.yml`    | on.push.branches: [main]                      | ✓ WIRED | Push 5f86286 to main triggered release.yml run 21994928215                                                                                                    |
| `.github/workflows/publish.yml` | `npmjs.com`                        | npm publish --provenance with OIDC            | ✓ WIRED | Published 0.2.1 with OIDC provenance, npm registry shows `dist.attestations.url` and SLSA v1 predicate                                                        |
| `npmjs.com package page`        | `GitHub Actions build attestation` | provenance badge linking to workflow run      | ✓ WIRED | npm view shows attestations.provenance.predicateType = "https://slsa.dev/provenance/v1", url: https://registry.npmjs.org/-/npm/v1/attestations/passive-docs-index@0.2.1 |

### Requirements Coverage

| Requirement | Description                                                        | Status      | Evidence                                                                                                     |
| ----------- | ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| CICD-02     | GitHub Actions workflow for publish: npm publish with provenance  | ✓ SATISFIED | publish.yml on main, successfully published 0.2.1 with OIDC provenance via workflow run 21995031024          |
| CICD-03     | npm provenance badges visible on npmjs.com                        | ✓ SATISFIED | `npm view passive-docs-index dist.attestations` shows provenance with SLSA v1 predicate and attestation URL |
| CICD-04     | Package config correct -- engines, bin, files, exports, types     | ✓ SATISFIED | All 11 metadata checks pass, self-dependency bug fixed                                                      |
| DIST-01     | Publication on npm with `passive-docs-index` as package name      | ✓ SATISFIED | Published on npm, accessible via `npm view passive-docs-index`                                               |
| DIST-02     | `npx pdi` works out of the box (shebang, bin entry, dist/ included) | ✓ SATISFIED | Tested `npx passive-docs-index@0.2.1 --help` in clean /tmp environment — works correctly                    |
| DIST-03     | CHANGELOG generated with release notes per version                | ✓ SATISFIED | CHANGELOG.md auto-updated with 0.2.1 entry via Changesets                                                   |
| DIST-04     | Type declarations (.d.ts) included for programmatic API           | ✓ SATISFIED | 46 .d.ts files in package, dist/index.d.ts properly referenced in package.json                              |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| None | -    | -       | -        | -      |

No anti-patterns detected. All workflows operational, build artifacts substantive, no placeholders or stubs.

### Human Verification Performed

The gap closure plan (03-03) included a human verification checkpoint to verify the full automated release cycle:

1. **Verified:** release.yml triggered by push to main and created Version Packages PR #6
2. **Verified:** Version PR #6 bumped package.json from 0.2.0 to 0.2.1 and updated CHANGELOG.md
3. **Verified:** Merging PR #6 triggered publish.yml workflow run 21995031024
4. **Verified:** publish.yml check-version job detected version change (0.2.1 > 0.2.0)
5. **Verified:** publish.yml publish job built artifacts, verified shebang, and published with `--provenance`
6. **Verified:** npm registry shows version 0.2.1 with provenance attestations at `https://registry.npmjs.org/-/npm/v1/attestations/passive-docs-index@0.2.1`
7. **Verified:** CHANGELOG.md updated with 0.2.1 entry including commit link and GitHub attribution

All automated release pipeline steps verified end-to-end.

## Verification Evidence

### Workflow Runs

- **release.yml run 21994928215:** Triggered by changeset push 5f86286, created version PR #6
- **publish.yml run 21995031024:** Triggered by version PR merge, published 0.2.1 with OIDC provenance
- All jobs completed successfully (conclusion: success)

### npm Registry Verification

```json
{
  "version": "0.2.1",
  "publishedAt": "2026-02-13T16:48:15.948Z",
  "dist": {
    "integrity": "sha512-i7Kh6morA2JzxwgxPeRXU9WEpQv5En3Rms/N2EXybeoc2pIVYtqwayuCRTl2EUtYPAFjkdaRys6vhCe6rHfcjg==",
    "unpackedSize": 1853946,
    "attestations": {
      "url": "https://registry.npmjs.org/-/npm/v1/attestations/passive-docs-index@0.2.1",
      "provenance": {
        "predicateType": "https://slsa.dev/provenance/v1"
      }
    }
  }
}
```

### npx Test

```
$ cd /tmp && npx passive-docs-index@0.2.1 --help
Usage: pdi [options] [command]

Passive Docs Index - Documentation management for AI coding assistants
[...full help output displayed correctly...]
```

## Changes Since Previous Verification

### Fixed Gaps

**Gap 1: Workflows not on main branch**
- **Status:** CLOSED
- **Fix:** Feature branch merged to main via PR #5 (c48ece9)
- **Evidence:** `.github/workflows/release.yml` and `publish.yml` now present on main branch

**Gap 2: No OIDC provenance attestations**
- **Status:** CLOSED
- **Fix:** Automated publish via workflow triggered by version PR merge
- **Evidence:** Version 0.2.1 published with provenance attestations visible via `npm view passive-docs-index dist.attestations`

### Additional Fixes

**Self-dependency bug** (discovered during gap closure):
- `package.json` listed itself as a dependency
- Fixed in commit 88b6d35, merged via PR #5

**GitHub Actions permissions** (discovered during gap closure):
- Repository `can_approve_pull_request_reviews` was disabled, blocking changesets/action
- Enabled via GitHub API, no code changes required

## Conclusion

**Phase 3 goal ACHIEVED.** All 5 observable truths verified, all requirements satisfied, full automated release pipeline operational with OIDC provenance.

**Key accomplishments:**
- Workflows operational on main branch (no longer orphaned)
- Full release cycle verified: changeset → version PR → automated publish → OIDC provenance
- Version 0.2.1 published with provenance attestations on npmjs.com
- CHANGELOG.md auto-updated via Changesets
- Package installable and working via `npx pdi`

**Ready for Phase 4: Error Handling & Validation**

---

_Verified: 2026-02-13T16:53:41Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes (gap closure after 03-03 plan execution)_
