# Feature Landscape: PDI v0.2.0 to v1.0

**Domain:** CLI developer tool / AI documentation indexing
**Researched:** 2026-02-05
**Overall confidence:** MEDIUM-HIGH (verified with official Claude Code docs, npm docs, ecosystem surveys)

---

## Table Stakes

Features users expect from an npm-published CLI developer tool in 2026. Missing any of these signals "not production ready" and discourages adoption.

| # | Feature | Why Expected | Complexity | Confidence | Notes |
|---|---------|-------------|------------|------------|-------|
| T1 | **Test suite with coverage** | Every credible npm package has tests. No tests = no trust for adoption. Contributors need tests to submit PRs safely. | Medium | HIGH | Vitest or bun test; target 80%+ coverage on core logic |
| T2 | **CI pipeline (GitHub Actions)** | Users check CI badges before installing. PRs need automated validation. Standard for all npm packages with >10 stars. | Low | HIGH | Lint + typecheck + test + build on push/PR |
| T3 | **npm provenance + trusted publishing** | npm ecosystem now expects supply-chain security after 2025-2026 supply chain attacks. Provenance badges visible on npmjs.com. | Low | HIGH | GitHub Actions OIDC, `--provenance` flag, npm CLI v11.5.1+ |
| T4 | **Proper npm package configuration** | `engines`, `bin`, `files`, `exports`, `types` -- all must be correct for consumers. Already partially done. | Low | HIGH | Verify `files` field, test `npx pdi` works |
| T5 | **CHANGELOG / release notes** | Users need to know what changed between versions. Required for credibility and adoption. | Low | HIGH | Changesets or manual; auto-generate from conventional commits |
| T6 | **Error handling + helpful messages** | CLI tools that crash with stack traces lose users immediately. `pdi doctor` exists but error paths need coverage. | Medium | HIGH | Wrap all commands in try/catch, user-friendly errors |
| T7 | **Postinstall sync hook** | Already listed in README as planned (`autoSyncOnInstall`). Users will expect docs to stay in sync automatically after `npm install`. | Low-Med | HIGH | `postinstall` script in consumer's package.json or documented setup |
| T8 | **English documentation** | README is currently in Portuguese. English is table stakes for npm packages targeting the global Claude Code community. | Low | HIGH | Translate README, keep PT version as README.pt-BR.md |

## Differentiators

Features that set PDI apart. Not expected from every CLI tool, but these create competitive advantage in the AI documentation tooling space.

| # | Feature | Value Proposition | Complexity | Confidence | Notes |
|---|---------|-------------------|------------|------------|-------|
| D1 | **Claude Code skills (`/pdi-*`)** | Users invoke `/pdi-analyze` or `/pdi-sync` directly in Claude Code without leaving the IDE. Massive DX improvement. PDI becomes "native" to the Claude Code workflow. | Medium | HIGH | Official Skills spec verified: SKILL.md with frontmatter, `$ARGUMENTS` substitution, supporting files in skill directory |
| D2 | **Claude Code hooks integration** | Auto-sync docs on `PostToolUse` Write events, inject PDI context on `SessionStart`, re-inject after compaction. Makes PDI truly "passive" -- zero manual intervention. | Medium | HIGH | Official Hooks spec verified: PostToolUse matcher, SessionStart compact matcher, JSON stdin/stdout protocol |
| D3 | **Claude Code plugin packaging** | Bundle skills + hooks + MCP config into a single installable plugin. Users run `/plugin install pdi` and get everything. Namespace: `/pdi:sync`, `/pdi:add`. | Medium | HIGH | Official Plugin spec verified: `.claude-plugin/plugin.json` manifest, `skills/`, `hooks/hooks.json`, `.mcp.json` |
| D4 | **Custom template system** | Let users define their own framework templates beyond the built-in 10. Community-contributed templates. Dramatically expands framework coverage. | Medium | MEDIUM | Template format already defined in `templates.ts`; need file-based loading + validation |
| D5 | **Monorepo support** | Auto-discover `packages/*/package.json` and create per-package or shared `.claude-docs/`. Many real-world projects are monorepos. | Medium-High | MEDIUM | Detect pnpm-workspace.yaml, npm workspaces, lerna; scope config per package |
| D6 | **VS Code extension** | TreeView showing indexed frameworks, status indicators, CodeLens for CLAUDE.md sections, command palette integration. Visual alternative to CLI. | High | MEDIUM | Separate package; TreeView API for framework list, CodeLens for PDI sections |
| D7 | **Automated freshness checking** | Periodically check if indexed docs are stale (new framework versions released). Notify user or auto-update. Differentiates from static doc tools. | Medium | MEDIUM | Compare installed package versions against template versions; cron or on-demand |
| D8 | **llms.txt integration** | Generate or consume llms.txt files for broader AI tool compatibility beyond Claude Code. Aligns with emerging documentation standard. | Low-Med | LOW | Emerging spec, not yet standardized; evaluate post-v1.0 |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain that would waste effort or harm the product.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|-------------|-----------|-------------------|
| A1 | **Full documentation hosting / rendering** | PDI is an indexer, not a doc platform. Building rendering competes with Mintlify, Docusaurus, etc. Massive scope creep. | Keep generating `.mdx` files. Let existing doc tools render if needed. |
| A2 | **Real-time MCP server** | Building a full MCP server for PDI adds massive complexity. Context7 already exists for this purpose, and PDI already integrates with it as a fallback. | Keep Context7 as the MCP fallback. Ship a `.mcp.json` in the plugin that configures Context7 for the user. |
| A3 | **Web dashboard** | Listed in current README roadmap, but a web UI is huge scope for a CLI tool. Users of Claude Code work in terminals, not browsers. | Ship the VS Code extension instead for visual needs. CLI `pdi status` already covers the info. |
| A4 | **Auto-generating code from docs** | Tempting but fundamentally different product. PDI provides context; the AI generates code. Crossing that boundary creates a code generation tool, not a docs tool. | Focus on providing the best possible context. Let Claude Code do the code generation. |
| A5 | **Global template registry / marketplace** | Building a hosted registry for templates is infrastructure-heavy. Premature for v1.0. | Support local file-based custom templates and Git URL imports. Let npm packages provide templates. |
| A6 | **Per-file watch mode** | Watching every doc file for changes is resource-heavy and unnecessary. Docs change rarely (on version bumps), not continuously. | Use event-driven sync (postinstall, explicit `pdi sync`, Claude Code hooks). |
| A7 | **Multi-AI-assistant support (Copilot, Cursor, etc.)** | Trying to support every AI assistant fragments focus. PDI's value prop is tightly coupled to CLAUDE.md and Claude Code's passive context model. | Stay Claude Code-first. The llms.txt differentiator (D8) can provide lightweight cross-tool compat later. |

---

## Feature Dependencies

```
T1 (Tests) ──────────────> T2 (CI Pipeline) ──────> T3 (npm Provenance)
                                │                         │
                                v                         v
                           T5 (CHANGELOG) ──────> npm publish workflow

T6 (Error Handling) ──> T1 (Tests need good error paths)

T8 (English Docs) ──> standalone (no deps, do first)

T7 (Postinstall Hook) ──> D2 (Claude Code Hooks - both are automation)

D1 (Skills) ─────────┐
D2 (Hooks)  ─────────┼──> D3 (Plugin bundles all three)
.mcp.json   ─────────┘

D4 (Custom Templates) ──> D5 (Monorepo Support needs per-package templates)

D6 (VS Code Extension) ──> standalone (but benefits from stable CLI API first)

D7 (Freshness Check) ──> T7 (can piggyback on install hooks)
```

### Critical Path

```
T8 (English) --> T1 (Tests) --> T2 (CI) --> T3 (Provenance) --> npm publish
                    |
                    +--> D1 (Skills) --> D3 (Plugin)
                    |
                    +--> D2 (Hooks) ---> D3 (Plugin)
                    |
                    +--> D4 (Custom Templates) --> D5 (Monorepo)
```

---

## v0.2.0 MVP Recommendation

For v0.2.0, prioritize table stakes that enable credible npm publishing, plus the highest-impact differentiator (Claude Code integration).

### Must Ship (v0.2.0)

1. **T8 - English documentation** -- Prerequisite for community adoption. Low effort, high impact.
2. **T1 - Test suite** -- Foundation for everything. Use `bun test` (already configured) or Vitest. Cover core: config read/write, index generation/parsing, template resolution, CLI command smoke tests.
3. **T2 - CI pipeline** -- GitHub Actions: lint, typecheck, test, build. Add badge to README.
4. **T3 - npm provenance** -- Trusted publishing via GitHub Actions OIDC. Automatic with CI pipeline.
5. **T6 - Error handling audit** -- Review all commands for unhandled errors. User-friendly messages.
6. **D1 - Claude Code skills** -- `/pdi-add`, `/pdi-sync`, `/pdi-status` as SKILL.md files. Ship in `.claude/skills/` in the repo.

### Should Ship (v0.2.0 stretch goals)

7. **T5 - CHANGELOG** -- Start with manual; add Changesets for future releases.
8. **T7 - Postinstall hook** -- Document `postinstall` setup for consumer projects.
9. **D2 - Claude Code hooks** -- `PostToolUse` auto-format, `SessionStart` context injection.

### Defer to v0.3.0+

- **D3 - Plugin packaging** -- Requires skills + hooks to be stable first.
- **D4 - Custom templates** -- Nice-to-have but not blocking adoption.
- **D5 - Monorepo support** -- Complex, needs user feedback on patterns first.
- **D6 - VS Code extension** -- High complexity, separate package, defer to v0.4.0+.
- **D7 - Freshness checking** -- Valuable but not critical for initial publish.
- **D8 - llms.txt** -- Emerging spec, evaluate when more standardized.

---

## Feature Prioritization Matrix

| Feature | Impact | Effort | Risk | Priority | Phase |
|---------|--------|--------|------|----------|-------|
| T8 English docs | HIGH | LOW | LOW | P0 | v0.2.0 |
| T1 Test suite | HIGH | MEDIUM | LOW | P0 | v0.2.0 |
| T2 CI pipeline | HIGH | LOW | LOW | P0 | v0.2.0 |
| T3 npm provenance | HIGH | LOW | LOW | P0 | v0.2.0 |
| T6 Error handling | MEDIUM | MEDIUM | LOW | P0 | v0.2.0 |
| D1 Claude Code skills | HIGH | MEDIUM | LOW | P1 | v0.2.0 |
| T5 CHANGELOG | MEDIUM | LOW | LOW | P1 | v0.2.0 |
| T7 Postinstall hook | MEDIUM | LOW | LOW | P1 | v0.2.0 |
| D2 Claude Code hooks | HIGH | MEDIUM | MEDIUM | P1 | v0.2.0 |
| D3 Plugin packaging | HIGH | MEDIUM | MEDIUM | P2 | v0.3.0 |
| D4 Custom templates | MEDIUM | MEDIUM | LOW | P2 | v0.3.0 |
| D7 Freshness checking | MEDIUM | MEDIUM | LOW | P2 | v0.3.0 |
| D5 Monorepo support | MEDIUM | HIGH | MEDIUM | P3 | v0.4.0 |
| D6 VS Code extension | MEDIUM | HIGH | HIGH | P3 | v0.4.0+ |
| D8 llms.txt | LOW | LOW | MEDIUM | P4 | v1.0 |

---

## Competitor / Comparable Feature Analysis

| Feature Area | PDI (current) | Context7 MCP | Mintlify | llms.txt / Docfork | Greptile |
|---|---|---|---|---|---|
| **Passive context in CLAUDE.md** | YES (core value) | No | No | No | No |
| **MCP fallback** | YES (Context7) | YES (native) | YES (MCP server) | No | No |
| **Compressed index format** | YES (~4KB) | No | No | Yes (llms.txt) | No |
| **Framework templates** | 10 built-in | N/A | N/A | N/A | N/A |
| **Auto-sync with package.json** | YES (sync command) | No | No | No | No |
| **Claude Code skills** | PLANNED | No | No | No | No |
| **Claude Code hooks** | PLANNED | No | No | No | No |
| **Plugin distribution** | PLANNED | No | No | No | No |
| **VS Code extension** | PLANNED | No | Yes | No | Yes |
| **Test suite** | MISSING | Yes | Yes | Varies | Yes |
| **npm provenance** | MISSING | Yes | N/A | Varies | N/A |
| **Monorepo support** | MISSING | N/A | Yes | No | Yes |
| **Custom templates** | MISSING | N/A | N/A | N/A | N/A |

### PDI's Unique Position

PDI occupies a unique niche: it is the only tool that creates **passive, always-in-context documentation indexes** for Claude Code. Context7 requires MCP tool invocation (still a decision point). Mintlify is a full documentation platform, not a developer tool. llms.txt is a spec for documentation providers, not consumers.

PDI's competitive moat is the elimination of the AI decision point -- achieving 100% trigger rate versus 44% for skills-based approaches. The v0.2.0 features (tests, CI, provenance, Claude Code skills/hooks) transform PDI from a working prototype into a credible, distributable npm package that integrates natively with Claude Code.

---

## Detailed Feature Specifications

### T1: Test Suite

**What to test:**
- Unit: Config read/write, index generation/parsing, template resolution, Context7 client (mocked)
- Integration: CLI command execution (smoke tests for each command)
- Snapshot: Generated index format, CLAUDE.md output

**Framework decision:** Use `bun test` (already in package.json scripts). It is Jest-compatible, supports mocking (`mock()`), snapshots (`toMatchSnapshot`), and watch mode. No additional dependency needed.

**Coverage target:** 80% line coverage on `src/lib/`, 60% on `src/commands/`.

**Confidence:** HIGH -- Bun test docs verified via official sources.

### D1: Claude Code Skills

**Skills to create:**

| Skill | Name | Trigger | Description |
|-------|------|---------|-------------|
| `/pdi-add` | pdi-add | User invokes | Add documentation for frameworks: `$ARGUMENTS` |
| `/pdi-sync` | pdi-sync | User invokes | Sync documentation with package.json dependencies |
| `/pdi-status` | pdi-status | User invokes | Show PDI index status and freshness |
| `/pdi-analyze` | pdi-analyze | Claude auto | Analyze project dependencies and suggest PDI improvements. Use when reviewing project setup or discussing documentation. |

**Directory structure:**
```
.claude/skills/
  pdi-add/
    SKILL.md
  pdi-sync/
    SKILL.md
  pdi-status/
    SKILL.md
  pdi-analyze/
    SKILL.md
    references/
      template-list.md
```

**Frontmatter pattern (example for pdi-add):**
```yaml
---
name: pdi-add
description: Add PDI documentation for specified frameworks
disable-model-invocation: true
argument-hint: [framework-names...]
allowed-tools: Bash(pdi *), Read, Glob
---
```

**Confidence:** HIGH -- Verified against official Claude Code skills documentation (code.claude.com/docs/en/skills).

### D2: Claude Code Hooks

**Hooks to create:**

| Hook | Event | Matcher | Purpose |
|------|-------|---------|---------|
| Auto-sync after install | PostToolUse | `Bash` | Detect `npm install`/`bun add` commands, trigger `pdi sync --yes` |
| Context injection | SessionStart | (none) | Output PDI index status to Claude's context at session start |
| Post-compaction re-inject | SessionStart | `compact` | Re-inject critical PDI context after compaction |

**Configuration (`.claude/settings.json`):**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "INPUT=$(cat); CMD=$(echo \"$INPUT\" | jq -r '.tool_input.command // empty'); if echo \"$CMD\" | grep -qE '(npm install|bun (add|install)|pnpm (add|install))'; then pdi sync --yes --quiet 2>/dev/null; fi"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "pdi status --json 2>/dev/null | jq -r '.summary // empty'"
          }
        ]
      }
    ]
  }
}
```

**Confidence:** HIGH -- Verified against official Claude Code hooks documentation (code.claude.com/docs/en/hooks-guide).

### D3: Claude Code Plugin

**Plugin structure:**
```
pdi-plugin/
  .claude-plugin/
    plugin.json
  skills/
    pdi-add/SKILL.md
    pdi-sync/SKILL.md
    pdi-status/SKILL.md
    pdi-analyze/SKILL.md
  hooks/
    hooks.json
  .mcp.json          # Configure Context7 MCP for fallback
```

**Manifest:**
```json
{
  "name": "pdi",
  "description": "Passive Docs Index - always-in-context documentation for Claude Code",
  "version": "0.2.0",
  "author": { "name": "syx-labs" },
  "homepage": "https://github.com/syx-labs/passive-docs-index",
  "repository": "https://github.com/syx-labs/passive-docs-index"
}
```

**Confidence:** HIGH -- Verified against official Claude Code plugins documentation (code.claude.com/docs/en/plugins).

### T3: npm Provenance + Trusted Publishing

**GitHub Actions workflow:**
```yaml
permissions:
  contents: read
  id-token: write    # Required for OIDC trusted publishing

steps:
  - uses: actions/checkout@v4
  - uses: oven-sh/setup-bun@v2
  - run: bun install
  - run: bun test
  - run: bun run build
  - run: npm publish --provenance --access public
    env:
      NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Requirements:** npm CLI v11.5.1+, GitHub Actions runner, `id-token: write` permission.

**Confidence:** HIGH -- Verified via npm official docs and multiple credible sources.

---

## Sources

### HIGH Confidence (Official Documentation)
- [Claude Code Skills](https://code.claude.com/docs/en/skills) -- Full SKILL.md specification, frontmatter reference, directory conventions
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks-guide) -- All event types, matchers, I/O protocol, configuration
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins) -- Plugin structure, manifest, distribution
- [Vitest Documentation](https://vitest.dev/guide/) -- Coverage, CI integration, features
- [Bun Test Runner](https://bun.sh/docs/test) -- Mock, snapshot, watch mode
- [npm Provenance](https://docs.npmjs.com/generating-provenance-statements/) -- Trusted publishing specification
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) -- OIDC setup

### MEDIUM Confidence (Multiple Sources Agree)
- [Lefthook vs Husky 2026](https://www.edopedia.com/blog/lefthook-vs-husky/) -- Git hooks tool comparison
- [Changesets](https://github.com/changesets/changesets) -- Monorepo versioning workflow
- [pnpm Workspaces](https://pnpm.io/workspaces) -- Monorepo patterns
- [VS Code Extension API](https://code.visualstudio.com/api/extension-capabilities/overview) -- TreeView, CodeLens, Webview patterns
- [npm Trusted Publishing Blog](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) -- Practical setup guide

### LOW Confidence (Single Source / Unverified)
- [Context7 Alternatives](https://www.aitoolnet.com/alternative/context7) -- Competitor landscape (30 alternatives listed)
- [llms.txt Specification](https://upstash.com/blog/context7-llmtxt-cursor) -- Emerging spec, not yet standardized
- [Claude Code Plugin Marketplace](https://claudecodemarketplace.com/) -- Third-party marketplace status
