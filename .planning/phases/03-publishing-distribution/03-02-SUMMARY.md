---
phase: 03-publishing-distribution
plan: 02
subsystem: infra
tags: [github-actions, npm, oidc, provenance, changesets, publish, release]

# Dependency graph
requires:
  - phase: 03-01
    provides: Two-step build pipeline, package.json metadata, Changesets initialization
  - phase: 02-ci-cd-pipeline
    provides: CI workflow with build, lint, typecheck, and test jobs
provides:
  - Automated version PR creation via changesets/action on push to main
  - Automated npm publish with OIDC provenance on version change
  - OIDC Trusted Publishing configured on npmjs.com (no tokens needed)
  - Package published and live on npmjs.com
affects: [future-phases-using-npm-package, end-to-end-release-pipeline]

# Tech tracking
tech-stack:
  added: ["changesets/action@v1", "actions/setup-node@v4"]
  patterns: ["Split workflow: release.yml (version PRs) + publish.yml (npm publish)", "OIDC Trusted Publishing for tokenless npm publish", "npm version gate: compare package.json vs registry before publish"]

key-files:
  created:
    - .github/workflows/release.yml
    - .github/workflows/publish.yml
  modified: []

key-decisions:
  - "Split workflow pattern: release.yml for version PRs, publish.yml for npm publish (per changesets/action issue #515)"
  - "OIDC Trusted Publishing over NPM_TOKEN secret for zero-maintenance automated publishing"
  - "npm upgraded to latest in CI for OIDC support (Node 22 LTS ships npm 10.x, need >= 11.5.1)"
  - "Two-job publish workflow: check-version gates publish to avoid unnecessary OIDC attempts"
  - "cancel-in-progress: false on publish to never abort a publish mid-flight"

patterns-established:
  - "Split release workflow: changesets/action creates version PRs, separate publish workflow handles npm publish"
  - "OIDC provenance: id-token write permission + npm publish --provenance --access public"
  - "Version gate: compare package.json version vs npm registry before attempting publish"

# Metrics
duration: ~5min
completed: 2026-02-13
---

# Phase 3 Plan 2: Publish Workflow Summary

**Automated release pipeline with Changesets version PRs and OIDC-provenance npm publishing, bootstrapped with first manual publish**

## Performance

- **Duration:** ~5 min (Task 1 automated ~3 min + Task 2 human-verified)
- **Started:** 2026-02-13T16:13:00Z
- **Completed:** 2026-02-13T16:23:36Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Created release.yml workflow that uses changesets/action to auto-create "Version Packages" PRs on push to main
- Created publish.yml workflow with OIDC provenance publishing, npm version gate, build artifact verification, and npm upgrade for OIDC support
- First manual publish of passive-docs-index v0.2.0 to npmjs.com completed successfully
- OIDC Trusted Publishing configured on npmjs.com (syx-labs/passive-docs-index, publish.yml) -- subsequent publishes need no tokens

## Task Commits

Each task was committed atomically:

1. **Task 1: Create release.yml and publish.yml workflows** - `33568bb` (feat)
2. **Task 2: First publish bootstrapping and OIDC configuration** - Human-verified checkpoint (manual npm publish + OIDC setup on npmjs.com)

## Files Created/Modified
- `.github/workflows/release.yml` - Changesets version PR automation on push to main (changesets/action@v1, contents + pull-requests write permissions, concurrency control)
- `.github/workflows/publish.yml` - npm publish with OIDC provenance on version change (two-job design: check-version + publish, npm upgrade for OIDC, build artifact verification, --provenance --access public)

## Decisions Made
- Split workflow pattern (release.yml + publish.yml) per changesets/action issue #515 to avoid race conditions between version PR creation and npm publish
- OIDC Trusted Publishing chosen over NPM_TOKEN secret for zero-maintenance automated publishing
- npm upgraded to latest in CI because Node 22 LTS ships npm 10.x but OIDC requires >= 11.5.1
- Two-job publish workflow design: check-version job compares package.json vs npm registry, gates the publish job
- cancel-in-progress: false on publish workflow to prevent aborting a publish mid-flight

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Completed during Task 2 checkpoint:
- First manual `npm publish --access public` to bootstrap the package on npmjs.com
- OIDC Trusted Publishing configured on npmjs.com (Settings -> Trusted Publishers -> Add GitHub Actions: syx-labs/passive-docs-index, publish.yml)
- No further manual setup required -- publishing is now fully automated via OIDC

## Next Phase Readiness
- Complete release pipeline operational: changesets -> version PR -> merge -> auto-publish with provenance
- Package live on npmjs.com with OIDC trusted publishing configured
- Phase 3 (Publishing & Distribution) is fully complete
- Ready for Phase 4 and beyond

## Self-Check: PASSED

All files verified present, all commits found in git log.

---
*Phase: 03-publishing-distribution*
*Completed: 2026-02-13*
