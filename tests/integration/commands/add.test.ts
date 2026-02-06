/**
 * Integration Tests: add command
 *
 * Tests the full add command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Context7 HTTP/MCP (context7-client)
 * - Prompts (interactive selection)
 * - Console output, ora, chalk
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import {
  createConfig,
  createFrameworkConfig,
} from "../../helpers/factories.js";
import { createMockFs } from "../../helpers/mock-fs.js";

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
      if (prop === "default") {
        return new Proxy({}, handler);
      }
      if (prop === "__esModule") {
        return true;
      }
      return passthrough;
    },
    apply: (_target, _this, args) => args[0],
  };
  return { default: new Proxy({}, handler) };
});

// ---------------------------------------------------------------------------
// Mock prompts -- configurable per test
// ---------------------------------------------------------------------------

let promptsResponse: Record<string, unknown> = {};

mock.module("prompts", () => ({
  default: mock(async () => promptsResponse),
}));

// ---------------------------------------------------------------------------
// Mock context7-client -- controls whether docs fetch succeeds
// ---------------------------------------------------------------------------

const mockCheckAvailability = mock(async () => ({
  http: false,
  mcp: false,
  available: false,
  recommended: "offline" as const,
  message: "No source available",
}));

const mockQueryContext7 = mock(async () => ({
  success: false as const,
  error: "mocked offline",
  source: "none" as const,
}));

mock.module("../../../src/lib/context7-client.js", () => ({
  checkAvailability: (...args: unknown[]) =>
    mockCheckAvailability(...(args as [])),
  queryContext7: (...args: unknown[]) =>
    mockQueryContext7(...(args as [string, string])),
  resetClients: mock(),
  setMcpClient: mock(),
  resetMcpClient: mock(),
  isHttpClientAvailable: mock(() => false),
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { addCommand } = await import("../../../src/commands/add.js");

// ---------------------------------------------------------------------------
// Console spies
// ---------------------------------------------------------------------------

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  files.clear();
  promptsResponse = {};
  mockCheckAvailability.mockClear();
  mockQueryContext7.mockClear();
  logSpy = spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helper: seed a valid initialized project
// ---------------------------------------------------------------------------

function seedProject() {
  const config = createConfig({
    project: { name: "test-app", type: "backend" },
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({
      name: "test-app",
      version: "1.0.0",
      dependencies: { hono: "^4.3.0" },
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("addCommand", () => {
  test("adds a framework by name when template exists (offline mode)", async () => {
    seedProject();

    await addCommand(["hono"], { projectRoot: "/project", offline: true });

    // Doc files should be created
    let docFileCount = 0;
    for (const key of files.keys()) {
      if (key.startsWith("/project/.claude-docs/frameworks/hono/")) {
        docFileCount++;
      }
    }
    expect(docFileCount).toBeGreaterThan(0);

    // Config should be updated with hono entry
    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.frameworks.hono).toBeDefined();
    expect(config.frameworks.hono.source).toBe("template");
  });

  test("creates doc files in correct directory structure", async () => {
    seedProject();

    await addCommand(["hono"], { projectRoot: "/project", offline: true });

    // Should have files under frameworks/hono/api/ and frameworks/hono/patterns/
    const apiFiles = [...files.keys()].filter((k) =>
      k.includes("/frameworks/hono/api/")
    );
    const patternFiles = [...files.keys()].filter((k) =>
      k.includes("/frameworks/hono/patterns/")
    );

    expect(apiFiles.length).toBeGreaterThan(0);
    expect(patternFiles.length).toBeGreaterThan(0);
  });

  test("updates config.json with framework entry", async () => {
    seedProject();

    await addCommand(["zod"], { projectRoot: "/project", offline: true });

    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.frameworks.zod).toBeDefined();
    expect(config.frameworks.zod.version).toBeDefined();
    expect(config.frameworks.zod.files).toBeGreaterThan(0);
  });

  test("updates CLAUDE.md index after adding", async () => {
    seedProject();

    await addCommand(["hono"], { projectRoot: "/project", offline: true });

    // CLAUDE.md should exist with index
    expect(files.has("/project/CLAUDE.md")).toBe(true);
    const claudeMd = files.get("/project/CLAUDE.md")!;
    expect(claudeMd).toContain("hono");
  });

  test("handles unknown framework name (shows error)", async () => {
    seedProject();

    await addCommand(["nonexistent-framework"], {
      projectRoot: "/project",
      offline: true,
    });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Unknown frameworks"))).toBe(true);
  });

  test("handles uninitialized project", async () => {
    // No config.json
    await expect(
      addCommand(["hono"], { projectRoot: "/project" })
    ).rejects.toThrow("not initialized");
  });

  test("skips already-existing framework without --force", async () => {
    seedProject();
    // Add hono to config manually
    const config = createConfig({
      frameworks: { hono: createFrameworkConfig() },
    });
    files.set("/project/.claude-docs/config.json", JSON.stringify(config));

    await addCommand(["hono"], { projectRoot: "/project", offline: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Already exists"))).toBe(true);
  });

  test("Context7 API failure falls back to placeholder", async () => {
    seedProject();

    // Mock availability as HTTP available but query fails
    mockCheckAvailability.mockImplementation(async () => ({
      http: true,
      mcp: false,
      available: true,
      recommended: "http" as const,
      message: "Using Context7 HTTP API",
    }));

    mockQueryContext7.mockImplementation(async () => ({
      success: false,
      error: "API rate limit",
      source: "http" as const,
    }));

    await addCommand(["hono"], {
      projectRoot: "/project",
      force: true,
    });

    // Should still create files (placeholders)
    let docFileCount = 0;
    for (const key of files.keys()) {
      if (key.startsWith("/project/.claude-docs/frameworks/hono/")) {
        docFileCount++;
      }
    }
    expect(docFileCount).toBeGreaterThan(0);
  });
});
