/**
 * Integration Tests: status command
 *
 * Tests the full status command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Console output, chalk
 *
 * Note: status command does NOT use ora or prompts.
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
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { statusCommand } = await import("../../../src/commands/status.js");

// ---------------------------------------------------------------------------
// Console spies
// ---------------------------------------------------------------------------

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  files.clear();
  logSpy = spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helper: seed project with frameworks
// ---------------------------------------------------------------------------

function seedProject(
  frameworks: Record<string, ReturnType<typeof createFrameworkConfig>> = {},
  deps: Record<string, string> = {},
  lastSync: string | null = null
) {
  const config = createConfig({
    project: { name: "status-test", type: "backend" },
    frameworks,
    sync: { lastSync, autoSyncOnInstall: true },
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({
      name: "status-test",
      version: "1.0.0",
      dependencies: deps,
    })
  );

  // Add doc files for each framework
  for (const [name, fw] of Object.entries(frameworks)) {
    for (const cat of fw.categories || ["api"]) {
      files.set(
        `/project/.claude-docs/frameworks/${name}/${cat}/doc.mdx`,
        `# ${name} ${cat} docs`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("statusCommand", () => {
  test("shows framework list with versions and file counts", async () => {
    seedProject(
      {
        hono: createFrameworkConfig({
          version: "4.x",
          files: 7,
          categories: ["api", "patterns"],
        }),
      },
      { hono: "^4.3.0" }
    );

    await statusCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("hono"))).toBe(true);
    expect(logs.some((l) => l.includes("4.x"))).toBe(true);
  });

  test("shows index size information", async () => {
    seedProject(
      {
        hono: createFrameworkConfig({
          version: "4.x",
          files: 7,
          categories: ["api", "patterns"],
        }),
      },
      { hono: "^4.3.0" }
    );

    await statusCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Index:"))).toBe(true);
  });

  test("shows last sync time", async () => {
    seedProject(
      {
        hono: createFrameworkConfig(),
      },
      { hono: "^4.3.0" },
      "2026-01-15T10:30:00.000Z"
    );

    await statusCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Last sync:"))).toBe(true);
    // Should NOT show "never"
    expect(logs.some((l) => l.includes("never"))).toBe(false);
  });

  test("handles project with no frameworks configured", async () => {
    seedProject({}, {});

    await statusCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("No frameworks configured"))).toBe(true);
  });

  test("handles missing config.json (uninitialized)", async () => {
    await expect(statusCommand({ projectRoot: "/project" })).rejects.toThrow(
      "not initialized"
    );
  });

  test("shows missing frameworks when installed deps are undocumented", async () => {
    seedProject({}, { hono: "^4.3.0", zod: "^3.23.0" });

    await statusCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some(
        (l) => l.includes("Missing frameworks") || l.includes("not documented")
      )
    ).toBe(true);
  });

  test("shows last sync as never when no sync has occurred", async () => {
    seedProject({ hono: createFrameworkConfig() }, { hono: "^4.3.0" }, null);

    await statusCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("never"))).toBe(true);
  });
});
