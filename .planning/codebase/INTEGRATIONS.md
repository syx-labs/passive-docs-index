# External Integrations

**Analysis Date:** 2026-02-05

## APIs & External Services

**Context7 Documentation API:**
- Context7 HTTP API - Primary source for documentation retrieval
  - SDK/Client: `@upstash/context7-sdk` v0.3.0
  - Auth: `CONTEXT7_API_KEY` environment variable
  - Implementation: `src/lib/context7-client.ts`
  - Methods used:
    - `client.getContext(query, libraryId, { type: "json" })` - Retrieve documentation for a specific library
    - `client.searchLibrary(query, libraryName, { type: "json" })` - Search for libraries by name
  - Fallback: Uses HTTP SDK with error handling for library redirects (`src/lib/context7-client.ts` lines 181-219)
  - Note: API key can be configured interactively via `pdi auth` command (`src/commands/auth.ts`)

**MCP (Model Context Protocol) - Fallback:**
- Context7 MCP Provider (`plugin_context7_context7`)
  - Tools:
    - `plugin_context7_context7/query-docs` - Query documentation via MCP (`src/lib/mcp-client.ts` line 337-342)
    - `plugin_context7_context7/resolve-library-id` - Resolve library IDs via MCP (`src/lib/mcp-client.ts` line 365-370)
  - Access: Via `mcp-cli` command or Claude Code (`--mcp-cli`)
  - Detection: `src/lib/mcp-client.ts` lines 85-154 (searches PATH, Claude Code installation directories)
  - Platform support:
    - macOS: `~/.local/share/claude`, `~/.local/share/claude/versions`
    - Linux: `~/.local/bin`
    - Windows: `~/AppData/Local/Programs/claude`
  - Timeout: 60 seconds for doc queries, 30 seconds for library resolution

## Data Storage

**Databases:**
- None - This is a documentation indexing tool, not a database application

**File Storage:**
- Local filesystem only
  - Configuration: `.claude-docs/config.json` (`src/lib/constants.ts`)
  - Framework docs: `.claude-docs/frameworks/` (`src/lib/constants.ts`)
  - Internal patterns: `.claude-docs/internal/` (`src/lib/constants.ts`)
  - Index file: `CLAUDE.md` (git-committed markdown with auto-generated section)

**Caching:**
- In-memory caches:
  - Library ID resolution cache (`src/lib/context7-client.ts` lines 77-78, 108-129)
  - HTTP client cache (reuses client instance per API key)
  - MCP CLI availability cache (`src/lib/mcp-client.ts` lines 46-47)
- Disk cache:
  - Config file: `.claude-docs/config.json` with `mcp.cacheHours: 168` (1 week default)
  - Last sync timestamp: `config.sync.lastSync` field

## Authentication & Identity

**Auth Provider:**
- Custom implementation - No third-party auth provider
  - Implementation: `src/commands/auth.ts`
  - Storage: `${HOME}/.pdi/config.json` (persisted as plaintext)
  - Configuration method:
    1. Environment variable: `CONTEXT7_API_KEY` (highest priority)
    2. Saved config: `${HOME}/.pdi/config.json` (loaded by `src/commands/auth.ts`)
    3. Interactive prompt: `pdi auth` command
  - Logout: `pdi auth --logout` removes saved key
  - Status: `pdi auth --status` shows current auth state

## Monitoring & Observability

**Error Tracking:**
- None - Errors are logged to stderr via `console.error()`

**Logs:**
- Console-based logging
  - Output: Terminal stdout/stderr
  - Formatting: Chalk colors for error/success states
  - Verbosity: Controlled by command options (e.g., `--dry-run`, `--check`)
  - Progress indicators: Ora spinners for long-running operations

**Diagnostics:**
- `pdi doctor` command (`src/commands/doctor.ts`) - Provides system diagnostics
  - Checks Context7 availability
  - Checks MCP availability
  - Validates configuration
  - Provides recommendations

## CI/CD & Deployment

**Hosting:**
- npm Registry - Published as `passive-docs-index`
- GitHub - Source repository at `https://github.com/syx-labs/passive-docs-index`

**CI Pipeline:**
- None detected - No `.github/workflows` or CI configuration files
- Build process:
  - `bun build src/cli.ts --outfile dist/cli.js --target node --format esm`
  - `bun build src/index.ts --outfile dist/index.js --target node --format esm`
  - Triggered by `prepublishOnly` hook before npm publish

**Distribution:**
- npm package
  - CLI bin entry: `pdi` → `./dist/cli.js`
  - Main export: `./dist/index.js`
  - Types: `./dist/index.d.ts`
  - Published files: `dist/`, `templates/`

## Environment Configuration

**Required env vars:**
- `CONTEXT7_API_KEY` (optional, fallback to MCP) - API key for Context7 HTTP service
  - Format: Begins with `ctx7sk-` prefix (per user messages in commands)
  - Source: Environment variable, config file, or interactive prompt

**Secrets location:**
- User config: `${HOME}/.pdi/config.json` (contains `CONTEXT7_API_KEY`)
- Never committed to git (config directory per `src/commands/auth.ts`)
- Local project config: `.claude-docs/config.json` (no secrets, only framework metadata)

**Optional env vars:**
- `NODE_ENV` - If set to `development`, may affect behavior
- `HOME` - Used for locating Claude installation and config directory

## Webhooks & Callbacks

**Incoming:**
- None - PDI is a CLI tool, not a server

**Outgoing:**
- None - PDI does not send webhooks or make callbacks
- Query-only integration with Context7 API (no state changes)

## Library Resolution & Mapping

**Context7 Library IDs:**
- Predefined mappings in `src/lib/constants.ts`:
  - `/honojs/hono` - Hono backend framework
  - `/expressjs/express` - Express.js
  - `/fastify/fastify` - Fastify
  - `/drizzle-team/drizzle-orm` - Drizzle ORM
  - `/prisma/prisma` - Prisma
  - `/better-auth/better-auth` - Better Auth
  - `/lucia-auth/lucia` - Lucia
  - `/nextauthjs/next-auth` - NextAuth.js
  - `/colinhacks/zod` - Zod validation
  - `/sinclairzx81/typebox` - TypeBox validation
  - `/fabian-hiller/valibot` - Valibot validation
  - `/facebook/react` - React
  - `/vercel/next.js` - Next.js
  - `/vuejs/vue` - Vue
  - `/sveltejs/svelte` - Svelte
  - `/tanstack/query` - TanStack Query
  - `/tanstack/router` - TanStack Router
  - `/tailwindlabs/tailwindcss.com` - Tailwind CSS
  - `/vitejs/vite` - Vite
  - `/evanw/esbuild` - esbuild
  - `/vitest-dev/vitest` - Vitest
  - `/microsoft/playwright` - Playwright

**Resolution Strategy:**
1. Dynamic resolution via `client.searchLibrary()` when library ID not found locally
2. Fallback MCP resolution via `resolveContext7Library()` (`src/lib/mcp-client.ts`)
3. Caching of resolved IDs to avoid repeated lookups
4. Redirect handling: If library is redirected (e.g., renamed), automatically resolves to new ID

---

*Integration audit: 2026-02-05*
