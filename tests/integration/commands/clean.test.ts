/**
 * Integration Tests: clean command
 *
 * Tests the full clean command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Prompts (confirmation)
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
// Mock prompts
// ---------------------------------------------------------------------------

let promptsResponse: Record<string, unknown> = {};

mock.module("prompts", () => ({
  default: mock(async () => promptsResponse),
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { cleanCommand } = await import("../../../src/commands/clean.js");

// ---------------------------------------------------------------------------
// Console spies
// ---------------------------------------------------------------------------

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  files.clear();
  promptsResponse = {};
  logSpy = spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helper: seed project with orphan framework
// ---------------------------------------------------------------------------

function seedProjectWithOrphan() {
  // Config has "hono" framework but package.json does NOT have hono
  const config = createConfig({
    project: { name: "clean-test", type: "backend" },
    frameworks: {
      hono: createFrameworkConfig({
        version: "4.x",
        files: 3,
        categories: ["api", "patterns"],
      }),
    },
    mcp: {
      fallbackEnabled: true,
      preferredProvider: "context7",
      libraryMappings: { hono: "/honojs/hono" },
      cacheHours: 168,
    },
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({
      name: "clean-test",
      version: "1.0.0",
      dependencies: {}, // No hono
    })
  );

  // Add orphan doc files
  files.set(
    "/project/.claude-docs/frameworks/hono/api/routing.mdx",
    "# Routing docs"
  );
  files.set(
    "/project/.claude-docs/frameworks/hono/patterns/middleware.mdx",
    "# Middleware docs"
  );

  // CLAUDE.md
  files.set("/project/CLAUDE.md", "# Project\n\nSome content.");
}

function seedCleanProject() {
  // Config with no orphans (hono is in both config and package.json)
  const config = createConfig({
    project: { name: "clean-test", type: "backend" },
    frameworks: {
      hono: createFrameworkConfig({
        version: "4.x",
        files: 2,
        categories: ["api"],
      }),
    },
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({
      name: "clean-test",
      version: "1.0.0",
      dependencies: { hono: "^4.3.0" },
    })
  );
  files.set(
    "/project/.claude-docs/frameworks/hono/api/routing.mdx",
    "# Routing"
  );
  files.set("/project/CLAUDE.md", "# Project\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("cleanCommand", () => {
  test("removes orphan framework docs and updates config when confirmed", async () => {
    seedProjectWithOrphan();
    promptsResponse = { confirmed: true };

    await cleanCommand({ projectRoot: "/project", yes: true });

    // Orphan doc files should be removed
    expect(
      files.has("/project/.claude-docs/frameworks/hono/api/routing.mdx")
    ).toBe(false);

    // Config should no longer have hono
    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.frameworks.hono).toBeUndefined();
  });

  test("prompts for confirmation before cleaning", async () => {
    seedProjectWithOrphan();
    promptsResponse = { confirmed: false };

    await cleanCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Cancelled"))).toBe(true);

    // Files should still exist (not cleaned)
    expect(
      files.has("/project/.claude-docs/frameworks/hono/api/routing.mdx")
    ).toBe(true);
  });

  test("shows no orphan docs found when all frameworks are in package.json", async () => {
    seedCleanProject();

    await cleanCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("No orphan docs found"))).toBe(true);
  });

  test("handles uninitialized project", async () => {
    await expect(cleanCommand({ projectRoot: "/project" })).rejects.toThrow(
      "not initialized"
    );
  });

  test("dry run mode does not remove files", async () => {
    seedProjectWithOrphan();

    await cleanCommand({ projectRoot: "/project", dryRun: true });

    // Files should still exist
    expect(
      files.has("/project/.claude-docs/frameworks/hono/api/routing.mdx")
    ).toBe(true);

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Dry run"))).toBe(true);
  });

  test("yes flag skips confirmation prompt", async () => {
    seedProjectWithOrphan();

    await cleanCommand({ projectRoot: "/project", yes: true });

    // Should proceed without prompting
    // Orphan doc files should be removed
    expect(
      files.has("/project/.claude-docs/frameworks/hono/api/routing.mdx")
    ).toBe(false);
  });
});
