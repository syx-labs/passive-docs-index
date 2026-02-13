# Phase 6: Claude Code Skills & Hooks — Context

## Phase Goal
Claude Code users can invoke PDI via slash commands and get automatic sync suggestions after installing packages.

## Decisions

### Skill Interaction Style

1. **Analyze = workflow guiado**: `/pdi-analyze` presents findings one by one and asks what to do with each (add missing framework? sync stale doc? clean orphan?). Not a one-shot report dump.
2. **Sync = preview + confirmation**: `/pdi-sync` shows what will be synchronized (frameworks, versions) and asks for confirmation before executing. No silent execution.
3. **Generate = discovery + add + custom queries**: `/pdi-generate` does full pipeline: first discovers and adds missing frameworks via Context7, then generates optimized Context7 topic queries based on project patterns (e.g., if project uses Next App Router, generates App Router-specific queries).
4. **Generate vs Sync are complementary**: `/pdi-generate` is the comprehensive discovery+add+sync workflow. `/pdi-sync` is the quick update of already-configured docs. Generate does everything, sync is the fast path.
5. **Output is adaptive**: Skills are prompts for Claude — let Claude format naturally (markdown, tables, etc.) without forcing a specific format. No hardcoded output templates.

### Hook Intrusiveness

1. **PostToolUse trigger = package changes**: Reacts when package.json or lockfile changed (not just new deps — also version updates). Silent on plain `npm install` that changes nothing.
2. **PostToolUse action = auto-execute sync + notify**: When changes detected, automatically runs `pdi sync` and tells the user what it did. Zero friction — no confirmation prompt.
3. **SessionStart = always + detailed if problems**: Always injects a compact summary ("5 frameworks indexed, all up to date"). If problems exist (stale, missing, orphaned), expands with details and action suggestions.
4. **SessionStart scope = full status with network**: Runs complete freshness check against npm registry. Provides real staleness info, not cached guesses. Accepts the latency trade-off for accurate data.

### What Analyze and Generate Produce

1. **Doc coverage = frameworks + versions + quality**: Coverage includes which frameworks from package.json are indexed, whether indexed versions match installed versions, AND index quality (size, completeness, last sync date).
2. **Suggestions = actions + discovery + cleanup**: Analyze suggests concrete actions (sync stale docs), discovers frameworks used but not indexed (e.g., "detected drizzle in code, want to add?"), and suggests cleanup of orphaned docs.
3. **Custom patterns = Context7 topic queries**: Generate produces optimized queries for Context7 tailored to project patterns. Example: if project uses Prisma with PostgreSQL, generates queries like "prisma postgresql migrations" instead of generic "prisma docs".
4. **Generate is the comprehensive path**: Generate covers the full lifecycle: detect missing → add → sync → generate custom queries. It's the "set up everything" command.

### Behavior Without Config / Offline

1. **No config = auto-init**: When a skill runs in a project without `.pdi/` config, it automatically runs `pdi init`, configures the project, and continues with the skill. No manual setup needed.
2. **Context7 down = partial degradation**: Local functions (analysis, config reading, package.json scanning) continue working. Only Context7-dependent operations (sync, fetch docs) fail gracefully with explanation.
3. **Hook errors = silent + log**: Hooks never produce user-visible errors. Failures are logged to a debug file for troubleshooting. Hooks are best-effort, never disruptive.
4. **Hooks without config = discovery mode**: In projects without PDI config, hooks do lightweight discovery: "This project uses React but doesn't have PDI configured. Run `/pdi-generate` to index docs." Proactive but not intrusive.

## Deferred Ideas

- Template customization system (Phase 8 scope — Phase 6 /pdi-generate only creates Context7 queries, not full template files)

## Constraints

- Skills are `.md` files in `.claude/commands/` — they are prompt instructions, not executable code
- Hooks are shell scripts in `.claude/hooks/` — they execute commands and return results
- SessionStart hook adds latency to every session start (network call to npm registry)
- PostToolUse auto-sync requires that `pdi sync` is non-destructive and idempotent
- Discovery mode in hooks should be lightweight (no network calls, just package.json scan)
