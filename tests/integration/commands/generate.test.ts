/**
 * Integration Tests: generate command
 *
 * Tests the full generate command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Console output, ora, chalk
 * - Prompts (confirmation)
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
import { createConfig } from "../../helpers/factories.js";
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

const { generateCommand } = await import("../../../src/commands/generate.js");

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
// Helper: seed project
// ---------------------------------------------------------------------------

function seedProject() {
  const config = createConfig({
    project: { name: "gen-test", type: "backend" },
  });
  files.set("/project/.claude-docs/config.json", JSON.stringify(config));
  files.set(
    "/project/package.json",
    JSON.stringify({
      name: "gen-test",
      version: "1.0.0",
      dependencies: { hono: "^4.3.0" },
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateCommand", () => {
  test("throws on uninitialized project", async () => {
    await expect(
      generateCommand("internal", { projectRoot: "/project" })
    ).rejects.toThrow("not initialized");
  });

  test("throws on unknown type", async () => {
    seedProject();

    await expect(
      generateCommand("unknown", { projectRoot: "/project" })
    ).rejects.toThrow("Unknown type");
  });

  test("scans project and shows no patterns when project is empty", async () => {
    seedProject();

    await generateCommand("internal", { projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("No patterns detected"))).toBe(true);
  });

  test("detects ESM imports pattern when .js extensions used", async () => {
    seedProject();

    // Create enough TS files with .js imports to trigger detection
    for (let i = 0; i < 15; i++) {
      files.set(
        `/project/src/module-${i}.ts`,
        `import { foo } from './bar.js';\nimport { baz } from '../utils.js';\nexport const x = ${i};`
      );
    }

    // Confirm generation
    promptsResponse = { confirm: true };

    await generateCommand("internal", { projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("ESM"))).toBe(true);
  });

  test("dry run shows what would be generated without writing", async () => {
    seedProject();

    // Create files with .js imports to trigger ESM detection
    for (let i = 0; i < 15; i++) {
      files.set(
        `/project/src/module-${i}.ts`,
        `import { foo } from './bar.js';\nimport { baz } from '../utils.js';\nexport const x = ${i};`
      );
    }

    await generateCommand("internal", {
      projectRoot: "/project",
      dryRun: true,
    });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Dry run"))).toBe(true);
    // Should not have written any internal doc files
    const internalFiles = [...files.keys()].filter((k) =>
      k.includes(".claude-docs/internal/")
    );
    expect(internalFiles.length).toBe(0);
  });

  test("cancellation stops generation", async () => {
    seedProject();

    for (let i = 0; i < 15; i++) {
      files.set(
        `/project/src/module-${i}.ts`,
        `import { foo } from './bar.js';\nimport { baz } from '../utils.js';\n`
      );
    }

    promptsResponse = { confirm: false };

    await generateCommand("internal", { projectRoot: "/project" });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Cancelled"))).toBe(true);
  });

  test("filters by category option", async () => {
    seedProject();

    // Create files that would trigger ESM detection (conventions category)
    for (let i = 0; i < 15; i++) {
      files.set(
        `/project/src/module-${i}.ts`,
        `import { foo } from './bar.js';\nimport { baz } from '../utils.js';\n`
      );
    }

    // Request only "database" category -- ESM is in "conventions"
    await generateCommand("internal", {
      projectRoot: "/project",
      category: "database",
    });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("No patterns detected"))).toBe(true);
  });
});
