/**
 * Integration Tests: init command
 *
 * Tests the full init command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Console output (console.log, console.error)
 * - Spinner (ora)
 * - Chalk (pass-through)
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
import { createMockFs } from "../../helpers/mock-fs.js";

// ---------------------------------------------------------------------------
// Filesystem mocks
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

// Mock ora (spinner) to no-op
mock.module("ora", () => ({
  default: () => ({
    start: mock(() => ({ succeed: mock(), fail: mock(), warn: mock() })),
    succeed: mock(),
    fail: mock(),
    warn: mock(),
  }),
}));

// Mock chalk to pass through strings
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

// Dynamic import AFTER mocks
const { initCommand } = await import("../../../src/commands/init.js");

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
// Tests
// ---------------------------------------------------------------------------

describe("initCommand", () => {
  test("creates .claude-docs structure and config.json when not initialized", async () => {
    // Set up: project with package.json but no config
    files.set(
      "/project/package.json",
      JSON.stringify({ name: "test-app", version: "1.0.0", dependencies: {} })
    );

    await initCommand({ projectRoot: "/project" });

    // config.json should be created
    expect(files.has("/project/.claude-docs/config.json")).toBe(true);

    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.project.name).toBe("test-app");
    expect(config.version).toBe("1.0.0");
  });

  test("skips initialization when already initialized (without --force)", async () => {
    // Set up: project already has config
    files.set(
      "/project/.claude-docs/config.json",
      JSON.stringify({ version: "1.0.0" })
    );

    await initCommand({ projectRoot: "/project" });

    // Should show already initialized message
    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("already initialized"))).toBe(true);
  });

  test("re-initializes when --force is true", async () => {
    // Set up: existing config
    files.set(
      "/project/.claude-docs/config.json",
      JSON.stringify({ version: "0.9.0" })
    );
    files.set(
      "/project/package.json",
      JSON.stringify({ name: "reinit-app", version: "1.0.0", dependencies: {} })
    );

    await initCommand({ projectRoot: "/project", force: true });

    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.project.name).toBe("reinit-app");
  });

  test("detects project type from package.json", async () => {
    files.set(
      "/project/package.json",
      JSON.stringify({
        name: "my-cli",
        version: "1.0.0",
        bin: { mycli: "./dist/cli.js" },
        dependencies: { commander: "^10.0.0" },
      })
    );

    await initCommand({ projectRoot: "/project" });

    const config = JSON.parse(files.get("/project/.claude-docs/config.json")!);
    expect(config.project.type).toBe("cli");
  });

  test("detects framework dependencies and shows them in output", async () => {
    files.set(
      "/project/package.json",
      JSON.stringify({
        name: "webapp",
        version: "1.0.0",
        dependencies: { hono: "^4.3.0", zod: "^3.23.0" },
      })
    );

    await initCommand({ projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Detected dependencies"))).toBe(true);
  });

  test("handles missing package.json gracefully", async () => {
    // No package.json in the project
    await initCommand({ projectRoot: "/project" });

    // config should NOT be created
    expect(files.has("/project/.claude-docs/config.json")).toBe(false);
  });

  test("updates .gitignore with cache entry", async () => {
    files.set(
      "/project/package.json",
      JSON.stringify({ name: "app", version: "1.0.0", dependencies: {} })
    );
    files.set("/project/.gitignore", "node_modules\n");

    await initCommand({ projectRoot: "/project" });

    const gitignore = files.get("/project/.gitignore")!;
    expect(gitignore).toContain(".claude-docs");
  });

  test("skips dependency detection when noDetect is true", async () => {
    files.set(
      "/project/package.json",
      JSON.stringify({
        name: "webapp",
        version: "1.0.0",
        dependencies: { hono: "^4.3.0" },
      })
    );

    await initCommand({ projectRoot: "/project", noDetect: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Detected dependencies"))).toBe(false);
  });
});
