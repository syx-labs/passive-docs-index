/**
 * Integration Tests: sync command
 *
 * Tests the full sync command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Prompts (confirmation)
 * - Context7 (via add command)
 * - Console output, ora, chalk
 */

import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { createMockFs } from "../../helpers/mock-fs.js";
import { createConfig, createFrameworkConfig } from "../../helpers/factories.js";

// ---------------------------------------------------------------------------
// Filesystem mocks
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

// ---------------------------------------------------------------------------
// Mock ora
// ---------------------------------------------------------------------------

mock.module("ora", () => ({
  default: () => ({
    start: mock(function (this: Record<string, unknown>) {
      return this;
    }),
    succeed: mock(),
    fail: mock(),
    warn: mock(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock chalk (pass-through)
// ---------------------------------------------------------------------------

mock.module("chalk", () => {
  const passthrough = (s: string) => s;
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === "default") return new Proxy({}, handler);
      if (prop === "__esModule") return true;
      return passthrough;
    },
    apply: (_target, _this, args) => args[0],
  };
  return { default: new Proxy({}, handler) };
});

// ---------------------------------------------------------------------------
// Mock prompts
// ---------------------------------------------------------------------------

let promptsResponse: Record<string, unknown> = {};

mock.module("prompts", () => ({
  default: mock(async () => promptsResponse),
}));

// ---------------------------------------------------------------------------
// Mock context7-client (used by addCommand internally)
// ---------------------------------------------------------------------------

mock.module("../../../src/lib/context7-client.js", () => ({
  checkAvailability: mock(async () => ({
    http: false,
    mcp: false,
    available: false,
    recommended: "offline" as const,
    message: "No source",
  })),
  queryContext7: mock(async () => ({
    success: false,
    error: "offline",
    source: "none" as const,
  })),
  resetClients: mock(),
  setMcpClient: mock(),
  resetMcpClient: mock(),
  isHttpClientAvailable: mock(() => false),
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { syncCommand } = await import("../../../src/commands/sync.js");

// ---------------------------------------------------------------------------
// Console spies
// ---------------------------------------------------------------------------

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  files.clear();
  promptsResponse = {};
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helper: seed project
// ---------------------------------------------------------------------------

function seedProject(
  frameworks: Record<string, ReturnType<typeof createFrameworkConfig>> = {},
  deps: Record<string, string> = {}
) {
  const config = createConfig({
    project: { name: "sync-test", type: "backend" },
    frameworks,
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({
      name: "sync-test",
      version: "1.0.0",
      dependencies: deps,
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("syncCommand", () => {
  test("detects frameworks from package.json and plans to add missing ones", async () => {
    // Project has hono installed but not documented
    seedProject({}, { hono: "^4.3.0" });
    promptsResponse = { confirmed: true };

    await syncCommand({ projectRoot: "/project", yes: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    // Should show hono as NOT DOCUMENTED or plan to add
    expect(
      logs.some((l) => l.includes("NOT DOCUMENTED") || l.includes("Add"))
    ).toBe(true);
  });

  test("skips already-indexed frameworks", async () => {
    // Project has hono installed AND documented
    seedProject(
      { hono: createFrameworkConfig({ version: "4.x" }) },
      { hono: "^4.3.0" }
    );

    await syncCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("in sync") || l.includes("OK"))).toBe(
      true
    );
  });

  test("does nothing when prompts returns no", async () => {
    // Project has hono installed but not documented
    seedProject({}, { hono: "^4.3.0" });
    promptsResponse = { confirmed: false };

    await syncCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Cancelled"))).toBe(true);
  });

  test("handles --yes flag (skips confirmation)", async () => {
    seedProject(
      { hono: createFrameworkConfig({ version: "4.x" }) },
      { hono: "^4.3.0" }
    );

    await syncCommand({ projectRoot: "/project", yes: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    // Should show sync result without asking
    expect(logs.some((l) => l.includes("in sync") || l.includes("OK"))).toBe(
      true
    );
  });

  test("handles uninitialized project", async () => {
    await syncCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("not initialized"))).toBe(true);
  });

  test("shows check-only mode without making changes", async () => {
    seedProject(
      { hono: createFrameworkConfig({ version: "4.x" }) },
      { hono: "^4.3.0" }
    );

    await syncCommand({ projectRoot: "/project", check: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("in sync"))).toBe(true);
  });
});
