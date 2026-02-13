# Phase 5: Automation — Context

## Phase Goal
PDI detects when docs are stale and can validate doc health in CI pipelines.

## Decisions

### Postinstall Behavior

1. **Always show something**: Even without PDI config, show a discovery hint ("Run `pdi init` to get started"). With config, show staleness details.
2. **Detailed list format**: When stale docs are detected, show framework names with version transitions (e.g., `react (v18.2→v19.0), next (v14.1→v15.0)`).
3. **Smart check**: Postinstall actually runs freshness logic internally — only shows message if there are real issues. Not a static reminder.
4. **Use npx/bunx**: Postinstall script uses `npx pdi status` to ensure it works even without global install. Handles the case where `pdi` isn't directly in PATH.

### Freshness Detection

1. **npm registry as source of truth**: Checks the npm registry for the latest published version of each framework. Requires network access.
2. **Major + Minor threshold**: A doc is "stale" only if the major or minor version changed. Patch differences are ignored. (e.g., 18.2→18.3 = stale, 18.2.0→18.2.1 = ok)
3. **Timestamp-based for non-npm**: Frameworks that don't correspond to npm packages use last-sync date as proxy. Marked stale after a configurable number of days without sync.
4. **Orphaned detection**: Frameworks in PDI config that are no longer in package.json are reported as "orphaned" with a suggestion to run `pdi clean`.

### --check Mode & CI Output

1. **Differentiated exit codes**: Each problem type gets its own exit code (e.g., exit 1 = stale, exit 2 = missing, etc.). Allows CI pipelines to react differently per problem type.
2. **Dual format with --format flag**: Default output is a human-readable table (framework, current version, indexed version, status). `--format=json` outputs structured JSON for tool integration.
3. **Orphaned = fail**: Orphaned frameworks cause a non-zero exit in --check mode. Forces the team to keep config clean by running `pdi clean` when dependencies are removed.
4. **Network required**: No offline fallback. If npm registry is unreachable, --check fails with a clear error rather than giving a potentially false "all ok" result.

## Deferred Ideas

(none captured)

## Constraints

- Postinstall must not significantly slow down `npm install` / `bun install`
- Exit codes must be documented for CI pipeline authors
- Network requirement means CI environments need outbound HTTPS access to registry.npmjs.org
