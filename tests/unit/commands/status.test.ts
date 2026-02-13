/**
 * Unit Tests: status command
 * Tests the freshness integration in the status command (--check and --format flags).
 *
 * Mocking strategy:
 * - mock.module for all heavy dependencies (config, fs-utils, index-parser, index-utils, templates, freshness)
 * - Isolates the freshness checking logic added in plan 05-02
 * - Uses bun:test mock utilities (established pattern)
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
import type { FreshnessCheckOutput } from "../../../src/lib/freshness.js";
import { createConfig } from "../../helpers/factories.js";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockConfigExists = mock(() => true);
const mockReadConfig = mock(async () => createConfig());
const mockReadPackageJson = mock(
  async () =>
    ({
      name: "test",
      version: "1.0.0",
      dependencies: {},
      devDependencies: {},
    }) as Record<string, unknown>
);
const mockDetectDependencies = mock(() => []);
const mockGetMajorVersion = mock((v: string) => v);

mock.module("../../../src/lib/config.js", () => ({
  configExists: (...args: any[]) => mockConfigExists(...args),
  readConfig: (...args: any[]) => mockReadConfig(...args),
  readPackageJson: (...args: any[]) => mockReadPackageJson(...args),
  detectDependencies: (...args: any[]) => mockDetectDependencies(...args),
  getMajorVersion: (...args: any[]) => mockGetMajorVersion(...args),
  cleanVersion: mock((v: string) => v),
  createDefaultConfig: mock(),
  writeConfig: mock(),
  updateFrameworkInConfig: mock(),
  removeFrameworkFromConfig: mock(),
  updateSyncTime: mock(),
  getConfigPath: mock(),
  getDocsPath: mock(),
  detectProjectType: mock(),
}));

const mockCalculateDocsSize = mock(
  async () =>
    ({ total: 0, frameworks: {} }) as {
      total: number;
      frameworks: Record<string, number>;
    }
);
const mockReadAllFrameworkDocs = mock(async () => ({}));
const mockReadInternalDocs = mock(async () => ({}));

mock.module("../../../src/lib/fs-utils.js", () => ({
  calculateDocsSize: (...args: any[]) => mockCalculateDocsSize(...args),
  readAllFrameworkDocs: (...args: any[]) => mockReadAllFrameworkDocs(...args),
  readInternalDocs: (...args: any[]) => mockReadInternalDocs(...args),
  ensureDir: mock(),
  removeDir: mock(),
  listDir: mock(),
  listDirRecursive: mock(),
  writeDocFile: mock(),
  writeInternalDocFile: mock(),
  readDocFile: mock(),
  readFrameworkDocs: mock(),
  formatSize: mock(),
  updateGitignore: mock(),
}));

const mockBuildIndexSections = mock(() => []);
const mockCalculateIndexSize = mock(() => 0);

mock.module("../../../src/lib/index-parser.js", () => ({
  buildIndexSections: (...args: any[]) => mockBuildIndexSections(...args),
  calculateIndexSize: (...args: any[]) => mockCalculateIndexSize(...args),
  parseIndex: mock(),
  generateIndex: mock(),
  generateIndexBlock: mock(),
  getClaudeMdPath: mock(),
  claudeMdExists: mock(),
  readClaudeMd: mock(),
  extractIndexFromClaudeMd: mock(),
  updateClaudeMdIndex: mock(),
}));

const mockBuildFrameworksIndex = mock(() => ({}));
const mockBuildInternalIndex = mock(() => ({}));

mock.module("../../../src/lib/index-utils.js", () => ({
  buildFrameworksIndex: (...args: any[]) => mockBuildFrameworksIndex(...args),
  buildInternalIndex: (...args: any[]) => mockBuildInternalIndex(...args),
  updateClaudeMdFromConfig: mock(),
}));

const mockHasTemplate = mock(() => false);

mock.module("../../../src/lib/templates.js", () => ({
  hasTemplate: (...args: any[]) => mockHasTemplate(...args),
  getTemplate: mock(),
  listTemplates: mock(),
  getTemplatesByCategory: mock(),
  getTemplatesByPriority: mock(),
  FRAMEWORK_TEMPLATES: {},
}));

const mockCheckFreshness = mock(
  async (): Promise<FreshnessCheckOutput> => ({
    results: [],
    exitCode: 0 as any,
    summary: { total: 0, stale: 0, missing: 0, orphaned: 0, upToDate: 0, unknown: 0 },
  })
);

mock.module("../../../src/lib/freshness.js", () => ({
  checkFreshness: (...args: any[]) => mockCheckFreshness(...args),
  checkVersionFreshness: mock(),
  EXIT_CODES: {
    SUCCESS: 0,
    STALE: 1,
    MISSING: 2,
    ORPHANED: 3,
    MIXED: 4,
    NETWORK_ERROR: 5,
  },
}));

mock.module("../../../src/lib/errors.js", () => ({
  ConfigError: class ConfigError extends Error {
    hint?: string;
    constructor(msg: string, opts?: any) {
      super(msg);
      this.hint = opts?.hint;
    }
  },
  NotInitializedError: class NotInitializedError extends Error {
    hint: string;
    constructor() {
      super("PDI is not initialized");
      this.hint = "Run `pdi init` to initialize.";
    }
  },
  PDIError: class PDIError extends Error {},
  Context7Error: class Context7Error extends Error {},
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

const { statusCommand } = await import("../../../src/commands/status.js");

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let consoleLogSpy: ReturnType<typeof spyOn>;
let processExitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  // Reset all mocks
  mockConfigExists.mockReset();
  mockConfigExists.mockReturnValue(true);

  mockReadConfig.mockReset();
  mockReadConfig.mockResolvedValue(createConfig());

  mockReadPackageJson.mockReset();
  mockReadPackageJson.mockResolvedValue({
    name: "test",
    version: "1.0.0",
    dependencies: {},
    devDependencies: {},
  });

  mockDetectDependencies.mockReset();
  mockDetectDependencies.mockReturnValue([]);

  mockGetMajorVersion.mockReset();
  mockGetMajorVersion.mockImplementation((v: string) => v);

  mockCalculateDocsSize.mockReset();
  mockCalculateDocsSize.mockResolvedValue({ total: 0, frameworks: {} });

  mockReadAllFrameworkDocs.mockReset();
  mockReadAllFrameworkDocs.mockResolvedValue({});

  mockReadInternalDocs.mockReset();
  mockReadInternalDocs.mockResolvedValue({});

  mockBuildFrameworksIndex.mockReset();
  mockBuildFrameworksIndex.mockReturnValue({});

  mockBuildInternalIndex.mockReset();
  mockBuildInternalIndex.mockReturnValue({});

  mockBuildIndexSections.mockReset();
  mockBuildIndexSections.mockReturnValue([]);

  mockCalculateIndexSize.mockReset();
  mockCalculateIndexSize.mockReturnValue(0);

  mockHasTemplate.mockReset();
  mockHasTemplate.mockReturnValue(false);

  mockCheckFreshness.mockReset();
  mockCheckFreshness.mockResolvedValue({
    results: [],
    exitCode: 0 as any,
    summary: { total: 0, stale: 0, missing: 0, orphaned: 0, upToDate: 0, unknown: 0 },
  });

  consoleLogSpy = spyOn(console, "log").mockImplementation(() => undefined);
  processExitSpy = spyOn(process, "exit").mockImplementation(
    (() => undefined) as any
  );
});

afterEach(() => {
  consoleLogSpy.mockRestore();
  processExitSpy.mockRestore();
});

// ===========================================================================
// Helper
// ===========================================================================

function makeFreshnessOutput(
  overrides: Partial<FreshnessCheckOutput> = {}
): FreshnessCheckOutput {
  return {
    results: [],
    exitCode: 0 as any,
    summary: { total: 0, stale: 0, missing: 0, orphaned: 0, upToDate: 0, unknown: 0 },
    ...overrides,
  };
}

// ===========================================================================
// --check flag tests
// ===========================================================================

describe("statusCommand --check flag", () => {
  test("--check with all fresh exits normally (no process.exit call)", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
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
        exitCode: 0 as any,
        summary: { total: 1, stale: 0, missing: 0, orphaned: 0, upToDate: 1, unknown: 0 },
      })
    );

    await statusCommand({ check: true });

    expect(processExitSpy).not.toHaveBeenCalled();
  });

  test("--check with stale docs calls process.exit(1)", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
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
        exitCode: 1 as any,
        summary: { total: 1, stale: 1, missing: 0, orphaned: 0, upToDate: 0, unknown: 0 },
      })
    );

    await statusCommand({ check: true });

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test("--check with missing docs calls process.exit(2)", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
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
        exitCode: 2 as any,
        summary: { total: 1, stale: 0, missing: 1, orphaned: 0, upToDate: 0, unknown: 0 },
      })
    );

    await statusCommand({ check: true });

    expect(processExitSpy).toHaveBeenCalledWith(2);
  });

  test("--check with orphaned docs calls process.exit(3)", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
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
        exitCode: 3 as any,
        summary: { total: 1, stale: 0, missing: 0, orphaned: 1, upToDate: 0, unknown: 0 },
      })
    );

    await statusCommand({ check: true });

    expect(processExitSpy).toHaveBeenCalledWith(3);
  });

  test("--check with mixed issues calls process.exit(4)", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
        results: [
          {
            framework: "react",
            displayName: "React",
            indexedVersion: "18.0.0",
            latestVersion: "19.0.0",
            status: "stale",
            diffType: "major",
          },
          {
            framework: "hono",
            displayName: "Hono",
            indexedVersion: "",
            latestVersion: null,
            status: "missing",
            diffType: null,
          },
        ],
        exitCode: 4 as any,
        summary: { total: 2, stale: 1, missing: 1, orphaned: 0, upToDate: 0, unknown: 0 },
      })
    );

    await statusCommand({ check: true });

    expect(processExitSpy).toHaveBeenCalledWith(4);
  });

  test("--check with network error calls process.exit(5)", async () => {
    mockCheckFreshness.mockRejectedValue(new Error("Network error"));

    await statusCommand({ check: true });

    expect(processExitSpy).toHaveBeenCalledWith(5);
  });
});

// ===========================================================================
// --format=json tests
// ===========================================================================

describe("statusCommand --format=json", () => {
  test("outputs valid JSON to stdout with correct structure", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
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
        exitCode: 0 as any,
        summary: { total: 1, stale: 0, missing: 0, orphaned: 0, upToDate: 1, unknown: 0 },
      })
    );

    await statusCommand({ format: "json" });

    // Find the JSON output call (the one that starts with "{")
    const jsonCall = consoleLogSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].trim().startsWith("{")
    );

    expect(jsonCall).toBeDefined();

    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.project).toBe("test-project");
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.status).toBe("ok");
    expect(parsed.exitCode).toBe(0);
    expect(parsed.issues).toBeArray();
    expect(parsed.summary).toBeDefined();
  });

  test("includes project, timestamp, status, exitCode, issues, summary fields", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
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
        exitCode: 1 as any,
        summary: { total: 1, stale: 1, missing: 0, orphaned: 0, upToDate: 0, unknown: 0 },
      })
    );

    await statusCommand({ format: "json" });

    const jsonCall = consoleLogSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].trim().startsWith("{")
    );

    expect(jsonCall).toBeDefined();

    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed).toHaveProperty("project");
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("status", "issues_found");
    expect(parsed).toHaveProperty("exitCode", 1);
    expect(parsed).toHaveProperty("issues");
    expect(parsed.issues.length).toBe(1);
    expect(parsed.issues[0].framework).toBe("react");
    expect(parsed.issues[0].type).toBe("stale");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.summary.stale).toBe(1);
  });

  test("--format=json with network error outputs error JSON", async () => {
    mockCheckFreshness.mockRejectedValue(new Error("Network error"));

    await statusCommand({ format: "json" });

    const jsonCall = consoleLogSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].trim().startsWith("{")
    );

    expect(jsonCall).toBeDefined();

    const parsed = JSON.parse(jsonCall![0]);
    expect(parsed.status).toBe("issues_found");
    expect(parsed.exitCode).toBe(5);
    expect(parsed.issues[0].type).toBe("network_error");
  });
});

// ===========================================================================
// Without --check flag
// ===========================================================================

describe("statusCommand without --check flag", () => {
  test("freshness issues are shown but process does NOT exit with non-zero", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
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
        exitCode: 1 as any,
        summary: { total: 1, stale: 1, missing: 0, orphaned: 0, upToDate: 0, unknown: 0 },
      })
    );

    await statusCommand();

    expect(processExitSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Backward compatibility
// ===========================================================================

describe("statusCommand backward compatibility", () => {
  test("without options, status command works as before", async () => {
    mockCheckFreshness.mockResolvedValue(
      makeFreshnessOutput({
        exitCode: 0 as any,
        summary: { total: 0, stale: 0, missing: 0, orphaned: 0, upToDate: 0, unknown: 0 },
      })
    );

    await statusCommand();

    expect(processExitSpy).not.toHaveBeenCalled();
    // Should have printed some output (header, etc.)
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});
