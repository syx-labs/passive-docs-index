/**
 * Unit Tests: postinstall.ts
 * Tests the postinstall hook that checks for staleness and reports to stderr.
 *
 * Mocking strategy:
 * - mock.module for node:fs, node:fs/promises (via createMockFs) to control config reads
 * - mock.module for freshness.ts (makes HTTP calls — must be mocked)
 * - Spy on process.stderr.write and process.exit
 * - All output should go to stderr, never stdout
 *
 * NOTE: We do NOT mock config.js — it runs against the mock filesystem.
 * This avoids global mock.module pollution that breaks other test files.
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
import { join } from "node:path";
import type { FreshnessCheckOutput } from "../../../src/lib/freshness.js";
import { createConfig } from "../../helpers/factories.js";
import { createMockFs } from "../../helpers/mock-fs.js";

// ---------------------------------------------------------------------------
// Mock filesystem (replaces mock.module("config.js"))
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

// ---------------------------------------------------------------------------
// Mock freshness (makes HTTP calls — must stay mocked)
// ---------------------------------------------------------------------------

const EXIT_CODES = {
  SUCCESS: 0,
  STALE: 1,
  MISSING: 2,
  ORPHANED: 3,
  MIXED: 4,
  NETWORK_ERROR: 5,
} as const;

const mockCheckFreshness = mock(
  async (): Promise<FreshnessCheckOutput> => ({
    results: [],
    exitCode: EXIT_CODES.SUCCESS,
    summary: { total: 0, stale: 0, missing: 0, orphaned: 0, upToDate: 0 },
  })
);

mock.module("../../../src/lib/freshness.js", () => ({
  checkFreshness: mockCheckFreshness,
  checkVersionFreshness: mock(),
  EXIT_CODES,
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

const { runPostinstall } = await import("../../../src/lib/postinstall.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();
const CONFIG_PATH = join(PROJECT_ROOT, ".claude-docs", "config.json");
const PKG_PATH = join(PROJECT_ROOT, "package.json");

function seedDefaultFiles(): void {
  files.set(CONFIG_PATH, JSON.stringify(createConfig()));
  files.set(
    PKG_PATH,
    JSON.stringify({
      name: "test",
      version: "1.0.0",
      dependencies: {},
      devDependencies: {},
    })
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let stderrWriteSpy: ReturnType<typeof spyOn>;
let processExitSpy: ReturnType<typeof spyOn>;
let consoleLogSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  files.clear();
  seedDefaultFiles();

  mockCheckFreshness.mockReset();
  mockCheckFreshness.mockResolvedValue({
    results: [],
    exitCode: EXIT_CODES.SUCCESS,
    summary: { total: 0, stale: 0, missing: 0, orphaned: 0, upToDate: 0 },
  });

  stderrWriteSpy = spyOn(process.stderr, "write").mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock override for overloaded write()
    (() => true) as never
  );
  processExitSpy = spyOn(process, "exit").mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock override for overloaded exit()
    (() => undefined) as never
  );
  consoleLogSpy = spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  stderrWriteSpy.mockRestore();
  processExitSpy.mockRestore();
  consoleLogSpy.mockRestore();
});

// ===========================================================================
// Helper
// ===========================================================================

function getStderrOutput(): string {
  return stderrWriteSpy.mock.calls.map((call) => String(call[0])).join("");
}

// ===========================================================================
// Tests
// ===========================================================================

describe("runPostinstall", () => {
  test("when no PDI config exists, writes discovery hint to stderr containing 'pdi init'", async () => {
    // Remove config file so configExists returns false
    files.delete(CONFIG_PATH);

    await runPostinstall();

    const output = getStderrOutput();
    expect(output).toContain("pdi init");
  });

  test("when config exists and all fresh, writes 'up-to-date' message to stderr", async () => {
    mockCheckFreshness.mockResolvedValue({
      results: [
        {
          framework: "react",
          displayName: "React",
          indexedVersion: "19.0.0",
          latestVersion: "19.0.0",
          status: "up-to-date",
          diffType: null,
        },
      ],
      exitCode: EXIT_CODES.SUCCESS,
      summary: { total: 1, stale: 0, missing: 0, orphaned: 0, upToDate: 1 },
    });

    await runPostinstall();

    const output = getStderrOutput();
    expect(output).toContain("up-to-date");
  });

  test("when config exists with stale docs, writes framework names with version transitions to stderr", async () => {
    mockCheckFreshness.mockResolvedValue({
      results: [
        {
          framework: "react",
          displayName: "React",
          indexedVersion: "18.0.0",
          latestVersion: "19.0.0",
          status: "stale",
          diffType: "major",
        },
      ],
      exitCode: EXIT_CODES.STALE,
      summary: { total: 1, stale: 1, missing: 0, orphaned: 0, upToDate: 0 },
    });

    await runPostinstall();

    const output = getStderrOutput();
    expect(output).toContain("Stale");
    expect(output).toContain("react");
    expect(output).toContain("v18.0.0");
    expect(output).toContain("v19.0.0");
  });

  test("when config exists with orphaned docs, writes orphaned framework names to stderr", async () => {
    mockCheckFreshness.mockResolvedValue({
      results: [
        {
          framework: "vue",
          displayName: "Vue",
          indexedVersion: "3.0.0",
          latestVersion: "3.5.0",
          status: "orphaned",
          diffType: null,
        },
      ],
      exitCode: EXIT_CODES.ORPHANED,
      summary: { total: 1, stale: 0, missing: 0, orphaned: 1, upToDate: 0 },
    });

    await runPostinstall();

    const output = getStderrOutput();
    expect(output).toContain("Orphaned");
    expect(output).toContain("vue");
  });

  test("when config exists with missing docs, writes missing framework names to stderr", async () => {
    mockCheckFreshness.mockResolvedValue({
      results: [
        {
          framework: "hono",
          displayName: "Hono",
          indexedVersion: "",
          latestVersion: null,
          status: "missing",
          diffType: null,
        },
      ],
      exitCode: EXIT_CODES.MISSING,
      summary: { total: 1, stale: 0, missing: 1, orphaned: 0, upToDate: 0 },
    });

    await runPostinstall();

    const output = getStderrOutput();
    expect(output).toContain("Missing");
    expect(output).toContain("hono");
  });

  test("never calls process.exit", async () => {
    mockCheckFreshness.mockResolvedValue({
      results: [
        {
          framework: "react",
          displayName: "React",
          indexedVersion: "18.0.0",
          latestVersion: "19.0.0",
          status: "stale",
          diffType: "major",
        },
      ],
      exitCode: EXIT_CODES.STALE,
      summary: { total: 1, stale: 1, missing: 0, orphaned: 0, upToDate: 0 },
    });

    await runPostinstall();

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  test("when readConfig throws, silently catches error and does not throw", async () => {
    // Seed with invalid JSON to make readConfig throw
    files.set(CONFIG_PATH, "{ invalid json }");

    // Should not throw
    await runPostinstall();

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  test("when checkFreshness throws (network error), silently catches and does not throw", async () => {
    mockCheckFreshness.mockRejectedValue(new Error("Network error"));

    // Should not throw
    await runPostinstall();

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  test("all output goes to stderr, never stdout", async () => {
    mockCheckFreshness.mockResolvedValue({
      results: [
        {
          framework: "react",
          displayName: "React",
          indexedVersion: "18.0.0",
          latestVersion: "19.0.0",
          status: "stale",
          diffType: "major",
        },
      ],
      exitCode: EXIT_CODES.STALE,
      summary: { total: 1, stale: 1, missing: 0, orphaned: 0, upToDate: 0 },
    });

    await runPostinstall();

    // stderr should have been called
    expect(stderrWriteSpy).toHaveBeenCalled();

    // console.log should NOT have been called by postinstall
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
