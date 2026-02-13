/**
 * Unit tests for config validation error formatting
 *
 * Tests that readConfig() throws ConfigError with proper messages
 * for various invalid config scenarios.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { createMockFs } from "../../helpers/mock-fs.js";

// ---------------------------------------------------------------------------
// Filesystem mocks
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

const { readConfig } = await import("../../../src/lib/config.js");
const { ConfigError } = await import("../../../src/lib/errors.js");

// ---------------------------------------------------------------------------
// Reset mock state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  files.clear();
});

const configPath = join("/project", ".claude-docs", "config.json");

// ============================================================================
// Corrupted JSON
// ============================================================================

describe("readConfig with corrupted JSON", () => {
  test("throws ConfigError", async () => {
    files.set(configPath, "{ invalid json !!!");
    await expect(readConfig("/project")).rejects.toBeInstanceOf(ConfigError);
  });

  test("error message mentions invalid JSON", async () => {
    files.set(configPath, "{ invalid json !!!");
    await expect(readConfig("/project")).rejects.toThrow("invalid JSON");
  });

  test("error has configPath set", async () => {
    files.set(configPath, "{ invalid json !!!");
    try {
      await readConfig("/project");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as InstanceType<typeof ConfigError>).configPath).toBe(
        configPath
      );
    }
  });

  test("error hint mentions pdi init --force", async () => {
    files.set(configPath, "{ invalid json !!!");
    try {
      await readConfig("/project");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as InstanceType<typeof ConfigError>).hint).toContain(
        "pdi init --force"
      );
    }
  });
});

// ============================================================================
// Schema-invalid configs
// ============================================================================

describe("readConfig with schema-invalid config", () => {
  test("wrong type for version field shows validation issue", async () => {
    files.set(
      configPath,
      JSON.stringify({
        version: 123,
        project: { name: "test", type: "backend" },
        sync: { lastSync: null, autoSyncOnInstall: true },
        frameworks: {},
        internal: { enabled: false, categories: [], totalFiles: 0 },
        mcp: {
          fallbackEnabled: false,
          preferredProvider: "context7",
          cacheHours: 24,
        },
        limits: { maxIndexKb: 30, maxDocsKb: 500, maxFilesPerFramework: 50 },
      })
    );

    try {
      await readConfig("/project");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as InstanceType<typeof ConfigError>;
      expect(configError.validationIssues).toBeDefined();
      expect(configError.validationIssues!.length).toBeGreaterThan(0);
      const versionIssue = configError.validationIssues!.find(
        (i) => i.path === "version"
      );
      expect(versionIssue).toBeDefined();
    }
  });

  test("invalid enum for project.type shows validation issue", async () => {
    files.set(
      configPath,
      JSON.stringify({
        version: "1.0.0",
        project: { name: "test", type: "invalid-type" },
        sync: { lastSync: null, autoSyncOnInstall: true },
        frameworks: {},
        internal: { enabled: false, categories: [], totalFiles: 0 },
        mcp: {
          fallbackEnabled: false,
          preferredProvider: "context7",
          cacheHours: 24,
        },
        limits: { maxIndexKb: 30, maxDocsKb: 500, maxFilesPerFramework: 50 },
      })
    );

    try {
      await readConfig("/project");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as InstanceType<typeof ConfigError>;
      expect(configError.validationIssues).toBeDefined();
      const typeIssue = configError.validationIssues!.find(
        (i) => i.path === "project.type"
      );
      expect(typeIssue).toBeDefined();
    }
  });

  test("missing required fields throws ConfigError with multiple issues", async () => {
    files.set(configPath, JSON.stringify({ version: "1.0.0" }));

    try {
      await readConfig("/project");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as InstanceType<typeof ConfigError>;
      expect(configError.validationIssues).toBeDefined();
      expect(configError.validationIssues!.length).toBeGreaterThan(1);
    }
  });

  test("completely empty object throws ConfigError with multiple issues", async () => {
    files.set(configPath, JSON.stringify({}));

    try {
      await readConfig("/project");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const configError = error as InstanceType<typeof ConfigError>;
      expect(configError.validationIssues).toBeDefined();
      expect(configError.validationIssues!.length).toBeGreaterThan(1);
      expect(configError.hint).toContain("pdi init --force");
    }
  });
});

// ============================================================================
// Valid config (happy path)
// ============================================================================

describe("readConfig with valid config", () => {
  test("returns parsed PDIConfig", async () => {
    const validConfig = {
      version: "1.0.0",
      project: { name: "test", type: "backend" },
      sync: { lastSync: null, autoSyncOnInstall: true },
      frameworks: {},
      internal: { enabled: false, categories: [], totalFiles: 0 },
      mcp: {
        fallbackEnabled: false,
        preferredProvider: "context7",
        cacheHours: 24,
      },
      limits: { maxIndexKb: 30, maxDocsKb: 500, maxFilesPerFramework: 50 },
    };
    files.set(configPath, JSON.stringify(validConfig));

    const result = await readConfig("/project");
    expect(result).not.toBeNull();
    expect(result!.project.name).toBe("test");
    expect(result!.version).toBe("1.0.0");
  });
});
