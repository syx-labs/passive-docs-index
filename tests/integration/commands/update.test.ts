/**
 * Integration Tests: update command
 *
 * Tests the full update command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Context7 (context7-client)
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
// Mock p-limit (pass-through concurrency)
// ---------------------------------------------------------------------------

mock.module("p-limit", () => ({
  default:
    () =>
    <T>(fn: () => T) =>
      fn(),
}));

// ---------------------------------------------------------------------------
// Mock context7-client
// ---------------------------------------------------------------------------

const mockCheckAvailability = mock(async () => ({
  http: true,
  mcp: false,
  available: true,
  recommended: "http" as const,
  message: "Using Context7 HTTP API",
}));

const mockQueryContext7 = mock(async () => ({
  success: true,
  content: "# Updated documentation content\n\nThis is updated doc content.",
  source: "http" as const,
}));

mock.module("../../../src/lib/context7-client.js", () => ({
  checkAvailability: (...args: unknown[]) =>
    mockCheckAvailability(...(args as [])),
  queryContext7: (...args: unknown[]) =>
    mockQueryContext7(...(args as [string, string])),
  resetClients: mock(),
  setMcpClient: mock(),
  resetMcpClient: mock(),
  isHttpClientAvailable: mock(() => true),
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { updateCommand } = await import("../../../src/commands/update.js");

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

  // Reset to default successful behavior
  mockCheckAvailability.mockImplementation(async () => ({
    http: true,
    mcp: false,
    available: true,
    recommended: "http" as const,
    message: "Using Context7 HTTP API",
  }));

  mockQueryContext7.mockImplementation(async () => ({
    success: true,
    content: "# Updated docs\n\nContent here.",
    source: "http" as const,
  }));

  logSpy = spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Helper: seed project
// ---------------------------------------------------------------------------

function seedProject(
  frameworks: Record<string, ReturnType<typeof createFrameworkConfig>> = {}
) {
  const config = createConfig({
    project: { name: "update-test", type: "backend" },
    frameworks,
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({ name: "update-test", version: "1.0.0", dependencies: {} })
  );

  // Add existing doc files for each framework
  for (const [name, fw] of Object.entries(frameworks)) {
    for (const cat of fw.categories || ["api"]) {
      files.set(
        `/project/.claude-docs/frameworks/${name}/${cat}/doc.mdx`,
        `# Old ${name} ${cat} content`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateCommand", () => {
  test("re-fetches docs for specified frameworks", async () => {
    seedProject({
      hono: createFrameworkConfig({
        version: "4.x",
        lastUpdate: "2020-01-01T00:00:00.000Z", // Old enough to skip the 24h check
        categories: ["api", "patterns"],
      }),
    });

    await updateCommand(["hono"], {
      projectRoot: "/project",
      yes: true,
      force: true,
    });

    // Config should be updated with new lastUpdate
    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.frameworks.hono.lastUpdate).not.toBe(
      "2020-01-01T00:00:00.000Z"
    );
    expect(config.frameworks.hono.source).toBe("context7");
  });

  test("updates all frameworks when none specified", async () => {
    seedProject({
      hono: createFrameworkConfig({
        version: "4.x",
        lastUpdate: "2020-01-01T00:00:00.000Z",
        categories: ["api"],
      }),
      zod: createFrameworkConfig({
        version: "3.x",
        lastUpdate: "2020-01-01T00:00:00.000Z",
        categories: ["api"],
        libraryId: "/colinhacks/zod",
      }),
    });

    promptsResponse = { confirm: true };

    await updateCommand([], {
      projectRoot: "/project",
      force: true,
    });

    // Both frameworks should be updated
    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.frameworks.hono.source).toBe("context7");
    expect(config.frameworks.zod.source).toBe("context7");
  });

  test("prompts for confirmation when updating all", async () => {
    seedProject({
      hono: createFrameworkConfig({
        version: "4.x",
        lastUpdate: "2020-01-01T00:00:00.000Z",
      }),
    });

    promptsResponse = { confirm: false };

    await updateCommand([], { projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Cancelled"))).toBe(true);
  });

  test("handles Context7 API failure during update", async () => {
    seedProject({
      hono: createFrameworkConfig({
        version: "4.x",
        lastUpdate: "2020-01-01T00:00:00.000Z",
        categories: ["api"],
      }),
    });

    // Make all queries fail
    mockQueryContext7.mockImplementation(async () => ({
      success: false,
      error: "API rate limit exceeded",
      source: "http" as const,
    }));

    await updateCommand(["hono"], {
      projectRoot: "/project",
      yes: true,
      force: true,
    });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some(
        (l) => l.includes("No files were updated") || l.includes("Failed")
      )
    ).toBe(true);
  });

  test("handles no documentation source available", async () => {
    seedProject({
      hono: createFrameworkConfig({
        version: "4.x",
        lastUpdate: "2020-01-01T00:00:00.000Z",
      }),
    });

    mockCheckAvailability.mockImplementation(async () => ({
      http: false,
      mcp: false,
      available: false,
      recommended: "offline" as const,
      message: "No documentation source available",
    }));

    await updateCommand(["hono"], {
      projectRoot: "/project",
      yes: true,
      force: true,
    });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some(
        (l) =>
          l.includes("No documentation source available") ||
          l.includes("CONTEXT7_API_KEY")
      )
    ).toBe(true);
  });

  test("handles uninitialized project", async () => {
    await expect(
      updateCommand(["hono"], { projectRoot: "/project" })
    ).rejects.toThrow("not initialized");
  });

  test("handles unknown framework name", async () => {
    seedProject({
      hono: createFrameworkConfig({ version: "4.x" }),
    });

    await updateCommand(["nonexistent"], {
      projectRoot: "/project",
      yes: true,
    });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some(
        (l) =>
          l.includes("Unknown frameworks") || l.includes("No valid frameworks")
      )
    ).toBe(true);
  });
});
