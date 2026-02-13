# Phase 3: Publishing & Distribution - Research

**Researched:** 2026-02-13
**Domain:** npm publishing, OIDC provenance, Changesets versioning, TypeScript declarations, CLI distribution
**Confidence:** HIGH

## Summary

Phase 3 transforms the PDI codebase into a properly distributable npm package with provenance, changelog automation, and type declarations. The core challenges are: (1) npm's token ecosystem has radically changed -- classic tokens were permanently revoked December 2025, and the recommended path is OIDC Trusted Publishing requiring npm >= 11.5.1; (2) Bun's bundler does not emit `.d.ts` files, requiring a separate `tsc --emitDeclarationOnly` step; (3) Changesets provides versioning and changelog automation but its GitHub Action has an open compatibility issue with OIDC (issue #515), requiring a split-workflow approach.

The project already has good foundations: the `package.json` has correct `bin`, `exports`, `types`, and `engines` fields, and `bun build` already produces a CLI bundle with the `#!/usr/bin/env node` shebang. The main gaps are: no `.d.ts` files in `dist/`, an empty `templates/` directory listed in `files`, no publish workflow, and no Changesets setup.

**Primary recommendation:** Use Changesets for versioning/changelog with a two-workflow approach: one workflow for version PRs (changesets/action), and a separate publish workflow triggered on GitHub release that uses OIDC Trusted Publishing with `npm install -g npm@latest` to get npm 11.5.1+. Use `tsc --emitDeclarationOnly` via a separate `tsconfig.build.json` for type declarations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @changesets/cli | ^2.27 | Version management and CHANGELOG generation | De facto standard for npm package versioning; supports single-package repos |
| @changesets/changelog-github | ^0.5 | GitHub-linked changelog entries | Adds PR links and contributor attribution to CHANGELOG.md |
| changesets/action | v1 (v1.7.0) | GitHub Action for automated version PRs | Official companion to @changesets/cli |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/setup-node | v4 | Node.js setup in CI with registry-url | Required for npm publish authentication (writes .npmrc) |
| npm CLI | >= 11.5.1 | Publishing with OIDC provenance | Installed via `npm install -g npm@latest` in CI publish job |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Changesets | semantic-release | semantic-release is fully automated (no manual changeset step) but overkill for single-package, less control over changelog content |
| Changesets | manual versioning | Simpler but error-prone, no automated changelogs |
| OIDC Trusted Publishing | Granular NPM token | Token approach requires rotation every 90 days (since Feb 2026); OIDC is zero-maintenance |

**Installation:**
```bash
bun add -d @changesets/cli @changesets/changelog-github
bunx changeset init
```

## Architecture Patterns

### Recommended Project Structure
```
.changeset/
  config.json          # Changesets configuration
  README.md            # Auto-generated instructions
.github/
  workflows/
    ci.yml             # Existing CI (lint, test, typecheck)
    release.yml        # NEW: Changesets version PR automation
    publish.yml        # NEW: npm publish with OIDC provenance
dist/
  cli.js              # Bundled CLI (bun build, has shebang)
  index.js            # Bundled library entry
  index.d.ts          # NEW: Type declarations (tsc)
  index.d.ts.map      # NEW: Declaration maps (tsc)
  cli.d.ts            # NEW: CLI type declarations
tsconfig.build.json    # NEW: Declaration-only emit config
```

### Pattern 1: Two-Workflow Release Strategy
**What:** Separate version-PR creation from npm publishing to support OIDC
**When to use:** When using Changesets with npm OIDC Trusted Publishing
**Why:** The changesets/action creates/updates version PRs on every push to main. If combined with OIDC publishing in the same workflow, every version PR update would require environment approval (GitHub issue #515).

**Workflow 1: release.yml** (triggered on push to main)
```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Version Packages
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - uses: changesets/action@v1
        with:
          title: "chore(release): version packages"
          commit: "chore(release): version packages"
          # No publish here -- separate workflow handles it
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Workflow 2: publish.yml** (triggered on GitHub release or merged version PR)
```yaml
name: Publish

on:
  push:
    branches: [main]
    paths:
      - 'package.json'  # Only when version changes

jobs:
  check-version:
    runs-on: ubuntu-latest
    outputs:
      should_publish: ${{ steps.check.outputs.changed }}
    steps:
      - uses: actions/checkout@v4
      - name: Check if version changed
        id: check
        run: |
          # Compare package.json version with npm registry
          CURRENT=$(node -p "require('./package.json').version")
          PUBLISHED=$(npm view passive-docs-index version 2>/dev/null || echo "0.0.0")
          if [ "$CURRENT" != "$PUBLISHED" ]; then
            echo "changed=true" >> "$GITHUB_OUTPUT"
          else
            echo "changed=false" >> "$GITHUB_OUTPUT"
          fi

  publish:
    needs: check-version
    if: needs.check-version.outputs.should_publish == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install -g npm@latest
      - run: bun install
      - run: bun run build
      - run: npm publish --provenance --access public
```

### Pattern 2: Two-Step Build (Bun + tsc)
**What:** Use `bun build` for JS bundles, `tsc` for `.d.ts` declarations
**When to use:** Always -- Bun does not support declaration emit
**Example:**

```json
// package.json scripts
{
  "build": "bun run build:js && bun run build:types",
  "build:js": "bun build src/cli.ts --outfile dist/cli.js --target node --format esm && bun build src/index.ts --outfile dist/index.js --target node --format esm",
  "build:types": "tsc -p tsconfig.build.json"
}
```

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "emitDeclarationOnly": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Pattern 3: Changesets Config for Single-Package Public Repo
**What:** Correct .changeset/config.json for a single public npm package
**Example:**
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.2/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "syx-labs/passive-docs-index" }
  ],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### Anti-Patterns to Avoid
- **Single workflow for versioning + OIDC publishing:** Forces manual environment approval on every push to main, blocking version PR automation
- **Using `bun publish`:** Bun does not support `--provenance` flag -- must use npm CLI for publishing
- **Relying on classic NPM tokens:** Permanently revoked since December 2025
- **Granular NPM tokens without rotation plan:** Max 90-day lifespan since February 2026; OIDC is maintenance-free
- **Single tsconfig for typecheck + declarations:** `noEmit` and `emitDeclarationOnly` conflict; use separate configs

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version bumping | Manual version edits in package.json | Changesets CLI | Semantic version calculation, handles major/minor/patch correctly |
| Changelog generation | Manual CHANGELOG.md editing | @changesets/changelog-github | Automated, links PRs, credits contributors |
| Provenance attestation | Custom signing/attestation | npm publish --provenance + OIDC | Cryptographic supply chain security via Sigstore |
| Version PR automation | Manual PR creation for releases | changesets/action | Creates/updates PR automatically, handles conflicts |
| Declaration file bundling | Manual .d.ts writing | tsc --emitDeclarationOnly | Automatically generates from TypeScript source |

**Key insight:** The npm ecosystem's security infrastructure (OIDC, provenance, Sigstore) is complex and rapidly evolving. Hand-rolling any part of this chain would be fragile and miss security updates.

## Common Pitfalls

### Pitfall 1: Missing shebang in built CLI
**What goes wrong:** `npx pdi` fails with "command not found" or shell tries to interpret JS as shell script
**Why it happens:** Some bundlers strip the shebang line during build
**How to avoid:** Verify `dist/cli.js` starts with `#!/usr/bin/env node` after every build. The current `bun build` preserves the shebang from `src/cli.ts` -- confirmed in current output.
**Warning signs:** `npx pdi` errors, `Permission denied`, or garbled output

### Pitfall 2: Empty templates/ directory in package
**What goes wrong:** `npm pack` includes an empty `templates/` directory, or users expect template files there
**Why it happens:** `package.json` lists `"files": ["dist", "templates"]` but templates are defined in code (`src/lib/templates.ts`), not as external files
**How to avoid:** Either remove `"templates"` from the `files` array (since templates are bundled in dist/index.js), or populate the directory with actual template files if needed later
**Warning signs:** `npm pack --dry-run` shows no template files

### Pitfall 3: Missing .d.ts files in published package
**What goes wrong:** IDE users importing `passive-docs-index` get no type information
**Why it happens:** `bun build` does not generate `.d.ts` files; `tsconfig.json` has `noEmit: true` so `tsc` alone won't emit
**How to avoid:** Create `tsconfig.build.json` with `emitDeclarationOnly: true` (overriding `noEmit`); add `build:types` script; verify `.d.ts` files exist in `dist/` before publish
**Warning signs:** `npm pack --dry-run` shows no `.d.ts` files

### Pitfall 4: npm trusted publishing first-publish chicken-and-egg
**What goes wrong:** Cannot configure OIDC trusted publisher on npmjs.com because the package doesn't exist yet
**Why it happens:** Trusted publisher settings are per-package on npmjs.com; requires an existing package
**How to avoid:** First publish must be done manually with `npm publish --access public` using a granular token, THEN configure OIDC trusted publishing for subsequent releases
**Warning signs:** 404 error on first OIDC publish attempt

### Pitfall 5: npm version too old for trusted publishing
**What goes wrong:** OIDC authentication silently fails or produces cryptic errors
**Why it happens:** npm trusted publishing requires npm >= 11.5.1; Node.js 22 LTS ships with npm 10.x
**How to avoid:** Add `npm install -g npm@latest` step in CI before publish; verify npm version in CI logs
**Warning signs:** Authentication failures despite correct OIDC configuration

### Pitfall 6: Missing registry-url in setup-node
**What goes wrong:** npm publish fails with authentication errors even with correct OIDC setup
**Why it happens:** `actions/setup-node` only writes `.npmrc` with auth configuration when `registry-url` is explicitly specified
**How to avoid:** Always include `registry-url: 'https://registry.npmjs.org'` in setup-node configuration
**Warning signs:** `E401` or `ENEEDAUTH` errors during publish

### Pitfall 7: repository.url format mismatch
**What goes wrong:** npm OIDC validation fails because repo URL doesn't match trusted publisher config
**Why it happens:** npm matches the `repository.url` field in package.json against the configured trusted publisher; format must match exactly
**How to avoid:** Ensure `repository.url` follows npm convention: `"git+https://github.com/syx-labs/passive-docs-index.git"`. Current value is `"https://github.com/syx-labs/passive-docs-index"` -- needs updating
**Warning signs:** 404 on npm publish with OIDC

### Pitfall 8: Changesets not initialized before first use
**What goes wrong:** `changeset version` fails, no .changeset directory
**Why it happens:** Forgot to run `changeset init` which creates `.changeset/` directory with config
**How to avoid:** Run `bunx changeset init` as first task, commit the `.changeset/` directory
**Warning signs:** Missing `.changeset/config.json`

## Code Examples

### Build Script with Type Declarations
```json
// package.json (updated scripts)
{
  "scripts": {
    "build": "bun run build:js && bun run build:types",
    "build:js": "bun build src/cli.ts --outfile dist/cli.js --target node --format esm && bun build src/index.ts --outfile dist/index.js --target node --format esm",
    "build:types": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "bun run build"
  }
}
```

### tsconfig.build.json
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "emitDeclarationOnly": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Changesets Initialization
```bash
# Install changesets
bun add -d @changesets/cli @changesets/changelog-github

# Initialize (creates .changeset/ directory)
bunx changeset init

# Edit .changeset/config.json for public access + GitHub changelog
```

### Verifying Package Contents Before Publish
```bash
# Check what will be included
npm pack --dry-run

# Expected output should include:
# dist/cli.js
# dist/index.js
# dist/index.d.ts
# dist/index.d.ts.map
# dist/cli.d.ts          (if cli exports types)
# package.json
# README.md
# LICENSE
# CHANGELOG.md
```

### Updated package.json fields
```json
{
  "files": [
    "dist"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/syx-labs/passive-docs-index.git"
  }
}
```

### First Manual Publish (Bootstrap)
```bash
# One-time: publish initial version to create package on npmjs.com
# Requires a granular NPM token (90-day max lifespan)
npm publish --access public

# Then configure OIDC trusted publishing on npmjs.com:
# Settings > Trusted Publishers > GitHub Actions
# Repository: syx-labs/passive-docs-index
# Workflow: publish.yml
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Classic NPM tokens | OIDC Trusted Publishing | Dec 2025 (revoked) | Classic tokens permanently revoked; must use OIDC or granular tokens |
| Granular tokens (no expiry) | Granular tokens (90-day max) | Feb 2026 | Tokens must be rotated; OIDC is recommended zero-maintenance alternative |
| NPM_TOKEN secret + npm publish | OIDC + npm publish --provenance | 2025-2026 | No secrets needed; provenance automatic with OIDC |
| Single publish workflow | Split version/publish workflows | 2025 (changesets #515) | Required for OIDC environment approval to not block version PRs |
| npm 10.x (Node 22 LTS) | npm 11.5.1+ (install globally) | 2026 | Must upgrade npm in CI for OIDC support |
| bun publish | npm publish | N/A | bun publish does not support --provenance; use npm for publish step |

**Deprecated/outdated:**
- **Classic NPM tokens:** Permanently revoked Dec 9, 2025
- **`bun publish --provenance`:** Not implemented; use npm CLI
- **Single workflow for changesets + OIDC publish:** Causes approval blocking (issue #515)

## Open Questions

1. **First publish bootstrapping**
   - What we know: OIDC trusted publishing requires an existing package on npmjs.com; first publish needs a granular token
   - What's unclear: Whether the project has already been published to npm as `passive-docs-index`
   - Recommendation: Check `npm view passive-docs-index` first; if 404, do initial manual publish with granular token before setting up OIDC

2. **Version PR trigger for publish**
   - What we know: Version PR merges bump package.json version; publish should trigger on version change
   - What's unclear: Best trigger mechanism -- push to main with path filter on package.json vs GitHub release event vs workflow_run
   - Recommendation: Use push to main + version comparison check (simplest, no manual step needed). Alternative: have changesets/action create a GitHub Release, then trigger publish on release event.

3. **templates/ directory disposition**
   - What we know: Currently empty, listed in package.json files array, templates are code-defined in src/lib/templates.ts
   - What's unclear: Whether future phases (Phase 8: Custom Templates) will need this directory
   - Recommendation: Remove `"templates"` from `files` array for now; Phase 8 can add it back if needed

## Sources

### Primary (HIGH confidence)
- npm Trusted Publishing docs: https://docs.npmjs.com/trusted-publishers/ - OIDC setup, requirements
- npm Provenance docs: https://docs.npmjs.com/generating-provenance-statements/ - --provenance flag, permissions
- changesets/action GitHub: https://github.com/changesets/action - v1.7.0, inputs/outputs, workflow examples
- changesets config docs: https://github.com/changesets/changesets/blob/main/docs/config-file-options.md - all config options
- changesets intro: https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md - workflow overview

### Secondary (MEDIUM confidence)
- Phil Nash blog (Jan 2026): https://philna.sh/blog/2026/01/28/trusted-publishing-npm/ - practical OIDC gotchas, --provenance still needed explicitly
- Bootstrapping NPM Provenance (Jan 2026): https://www.thecandidstartup.org/2026/01/26/bootstrapping-npm-provenance-github-actions.html - first-publish problem, Node 24 mention
- Ankush Kun OIDC guide: https://ankush.one/blogs/npm-oidc-publishing/ - complete workflow example
- npm classic token revocation: https://github.com/orgs/community/discussions/179562 - Dec 9, 2025 timeline
- changesets/action OIDC issue #515: https://github.com/changesets/action/issues/515 - split workflow requirement
- Ignace Maes blog: https://blog.ignacemaes.com/automate-npm-releases-on-github-using-changesets/ - complete tutorial

### Tertiary (LOW confidence)
- Bun .d.ts issue #5141: https://github.com/oven-sh/bun/issues/5141 - open feature request, no timeline
- Node.js 22 ships npm 10.x (not 11.x): verified via https://nodejs.org/en/blog/release/v22.18.0 but npm version in CI after `npm install -g npm@latest` needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Changesets is well-documented, widely used; OIDC is official npm recommendation
- Architecture: HIGH - Two-workflow pattern is documented solution to known issue; two-step build is standard for Bun projects
- Pitfalls: HIGH - Based on recent (Jan-Feb 2026) blog posts from people who hit these exact issues
- OIDC version requirements: MEDIUM - npm >= 11.5.1 confirmed by multiple sources, but exact behavior of `npm install -g npm@latest` on Node 22 runner needs CI verification
- First-publish bootstrapping: MEDIUM - well-documented pattern but project-specific steps depend on whether package already exists

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable domain; npm OIDC is settling but core patterns are established)
