/**
 * Integration Tests: doctor command
 *
 * Tests the full doctor command diagnostic flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Console output, ora, chalk
 * - Context7 availability check
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
    info: mock(),
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
// Mock context7-client
// ---------------------------------------------------------------------------

let mockAvailability = {
  http: false,
  mcp: false,
  available: false,
  recommended: "offline" as const,
  message: "No source",
};

mock.module("../../../src/lib/context7-client.js", () => ({
  checkAvailability: mock(async () => mockAvailability),
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

const { doctorCommand } = await import("../../../src/commands/doctor.js");

// ---------------------------------------------------------------------------
// Console spies
// ---------------------------------------------------------------------------

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  files.clear();
  mockAvailability = {
    http: false,
    mcp: false,
    available: false,
    recommended: "offline" as const,
    message: "No source",
  };
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
  frameworks: Record<string, ReturnType<typeof createFrameworkConfig>> = {},
  deps: Record<string, string> = {}
) {
  const config = createConfig({
    project: { name: "doctor-test", type: "backend" },
    frameworks,
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({
      name: "doctor-test",
      version: "1.0.0",
      dependencies: deps,
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("doctorCommand", () => {
  test("shows diagnostic results for initialized project", async () => {
    seedProject(
      { hono: createFrameworkConfig({ version: "4.x" }) },
      { hono: "^4.3.0" }
    );
    files.set("/project/CLAUDE.md", "# CLAUDE.md");

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Doctor"))).toBe(true);
  });

  test("shows errors for uninitialized project", async () => {
    files.set(
      "/project/package.json",
      JSON.stringify({ name: "test", dependencies: {} })
    );

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("not initialized"))).toBe(true);
  });

  test("shows all checks passed when fully configured", async () => {
    seedProject(
      { hono: createFrameworkConfig({ version: "4.x" }) },
      { hono: "^4.3.0" }
    );
    files.set("/project/CLAUDE.md", "# CLAUDE.md");
    mockAvailability = {
      http: true,
      mcp: false,
      available: true,
      recommended: "http",
      message: "Using Context7 HTTP API",
    };

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("All checks passed"))).toBe(true);
  });

  test("shows auth warning when MCP only", async () => {
    seedProject();
    mockAvailability = {
      http: false,
      mcp: true,
      available: true,
      recommended: "mcp",
      message: "MCP available",
    };

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some((l) => l.includes("warning") || l.includes("pdi auth"))
    ).toBe(true);
  });

  test("shows no frameworks warning", async () => {
    seedProject({}, {});

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some((l) => l.includes("none installed") || l.includes("No docs"))
    ).toBe(true);
  });

  test("shows recommendations for missing frameworks", async () => {
    seedProject({}, { hono: "^4.3.0" });

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("pdi add"))).toBe(true);
  });

  test("shows CLAUDE.md warning when missing", async () => {
    seedProject({ hono: createFrameworkConfig() }, { hono: "^4.3.0" });

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    // CLAUDE.md warning is in the summary section (console.log)
    expect(
      logs.some((l) => l.includes("CLAUDE.md") || l.includes("Will be created"))
    ).toBe(true);
  });

  test("handles project without package.json", async () => {
    const config = createConfig({
      project: { name: "no-pkg", type: "backend" },
    });
    files.set("/project/.claude-docs/config.json", JSON.stringify(config));

    await doctorCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    // The warning shows up in summary section
    expect(
      logs.some(
        (l) => l.includes("package.json") || l.includes("Node.js projects")
      )
    ).toBe(true);
  });
});
