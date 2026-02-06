/**
 * Unit tests for src/lib/config.ts
 *
 * Tests all exported functions: getConfigPath, getDocsPath, configExists,
 * readConfig, writeConfig, createDefaultConfig, readPackageJson,
 * detectProjectType, detectDependencies, cleanVersion, getMajorVersion,
 * updateFrameworkInConfig, removeFrameworkFromConfig, updateSyncTime.
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { join } from "node:path";
import {
  createConfig,
  createFrameworkConfig,
} from "../../helpers/factories.js";
import { createMockFs } from "../../helpers/mock-fs.js";

// ---------------------------------------------------------------------------
// Filesystem mocks -- must be set up BEFORE importing config.ts
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

// Dynamic import of the module under test (after mocks are registered)
const {
  getConfigPath,
  getDocsPath,
  configExists,
  readConfig,
  writeConfig,
  createDefaultConfig,
  readPackageJson,
  detectProjectType,
  detectDependencies,
  cleanVersion,
  getMajorVersion,
  updateFrameworkInConfig,
  removeFrameworkFromConfig,
  updateSyncTime,
} = await import("../../../src/lib/config.js");

// Fixture loaders
const validConfigFixture = await Bun.file(
  join(import.meta.dir, "../../fixtures/config/valid-config.json")
).text();
const cliProjectFixture = await Bun.file(
  join(import.meta.dir, "../../fixtures/package-json/cli-project.json")
).text();
const frontendProjectFixture = await Bun.file(
  join(import.meta.dir, "../../fixtures/package-json/frontend-project.json")
).text();
const fullstackProjectFixture = await Bun.file(
  join(import.meta.dir, "../../fixtures/package-json/fullstack-project.json")
).text();

// ---------------------------------------------------------------------------
// Reset mock state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  files.clear();
});

// ============================================================================
// getConfigPath / getDocsPath
// ============================================================================

describe("getConfigPath", () => {
  test("returns correct path joining projectRoot + .claude-docs/config.json", () => {
    const result = getConfigPath("/my/project");
    expect(result).toBe(join("/my/project", ".claude-docs", "config.json"));
  });
});

describe("getDocsPath", () => {
  test("returns correct path joining projectRoot + .claude-docs", () => {
    const result = getDocsPath("/my/project");
    expect(result).toBe(join("/my/project", ".claude-docs"));
  });
});

// ============================================================================
// configExists
// ============================================================================

describe("configExists", () => {
  test("returns true when config file exists", async () => {
    const configPath = join("/project", ".claude-docs", "config.json");
    files.set(configPath, "{}");
    const result = await configExists("/project");
    expect(result).toBe(true);
  });

  test("returns false when config file does not exist", async () => {
    const result = await configExists("/project");
    expect(result).toBe(false);
  });
});

// ============================================================================
// readConfig
// ============================================================================

describe("readConfig", () => {
  test("returns parsed config when file exists with valid JSON", async () => {
    const configPath = join("/project", ".claude-docs", "config.json");
    files.set(configPath, validConfigFixture);

    const result = await readConfig("/project");
    expect(result).not.toBeNull();
    expect(result!.project.name).toBe("my-saas-app");
    expect(result!.project.type).toBe("fullstack");
    expect(result!.frameworks.hono).toBeDefined();
    expect(result!.frameworks.drizzle).toBeDefined();
  });

  test("returns null when config file does not exist", async () => {
    const result = await readConfig("/project");
    expect(result).toBeNull();
  });

  test("throws Error when file has invalid JSON", async () => {
    const configPath = join("/project", ".claude-docs", "config.json");
    files.set(configPath, "{ invalid json !!!");

    await expect(readConfig("/project")).rejects.toThrow(
      "Failed to read config"
    );
  });
});

// ============================================================================
// writeConfig
// ============================================================================

describe("writeConfig", () => {
  test("writes JSON to correct path", async () => {
    const config = createConfig({ project: { name: "test", type: "cli" } });
    await writeConfig("/project", config);

    const configPath = join("/project", ".claude-docs", "config.json");
    expect(files.has(configPath)).toBe(true);
  });

  test("creates directory if it doesn't exist", async () => {
    const config = createConfig();
    await writeConfig("/project", config);
    expect(fsPromisesMock.mkdir).toHaveBeenCalled();
  });

  test("writes JSON with 2-space indent (pretty-printed)", async () => {
    const config = createConfig({
      project: { name: "pretty-test", type: "backend" },
    });
    await writeConfig("/project", config);

    const configPath = join("/project", ".claude-docs", "config.json");
    const written = files.get(configPath)!;
    // JSON.stringify with 2-space indent
    expect(written).toBe(JSON.stringify(config, null, 2));
  });
});

// ============================================================================
// createDefaultConfig
// ============================================================================

describe("createDefaultConfig", () => {
  test("returns config with correct project name and type", () => {
    const config = createDefaultConfig("my-app", "frontend");
    expect(config.project.name).toBe("my-app");
    expect(config.project.type).toBe("frontend");
  });

  test("has empty frameworks object", () => {
    const config = createDefaultConfig("my-app", "backend");
    expect(config.frameworks).toEqual({});
  });

  test("has null lastSync", () => {
    const config = createDefaultConfig("my-app", "backend");
    expect(config.sync.lastSync).toBeNull();
  });

  test("has version 1.0.0", () => {
    const config = createDefaultConfig("my-app", "backend");
    expect(config.version).toBe("1.0.0");
  });
});

// ============================================================================
// readPackageJson
// ============================================================================

describe("readPackageJson", () => {
  test("returns parsed package.json when file exists", async () => {
    const pkgPath = join("/project", "package.json");
    files.set(pkgPath, cliProjectFixture);

    const result = await readPackageJson("/project");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my-cli-tool");
    expect(result!.bin).toBeDefined();
  });

  test("returns null when file doesn't exist", async () => {
    const result = await readPackageJson("/project");
    expect(result).toBeNull();
  });

  test("returns null when file has invalid JSON and logs error", async () => {
    const pkgPath = join("/project", "package.json");
    files.set(pkgPath, "not json {{{");

    const consoleSpy = spyOn(console, "error").mockImplementation(
      () => undefined
    );
    const result = await readPackageJson("/project");
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ============================================================================
// detectProjectType
// ============================================================================

describe("detectProjectType", () => {
  test('returns "cli" when package.json has bin field', () => {
    const pkg = JSON.parse(cliProjectFixture);
    const result = detectProjectType(pkg);
    expect(result).toBe("cli");
  });

  test('returns "frontend" when has react dependency', () => {
    const pkg = JSON.parse(frontendProjectFixture);
    const result = detectProjectType(pkg);
    expect(result).toBe("frontend");
  });

  test('returns "fullstack" when has both backend and frontend deps', () => {
    const pkg = JSON.parse(fullstackProjectFixture);
    const result = detectProjectType(pkg);
    expect(result).toBe("fullstack");
  });

  test('returns "library" when has exports/main but no app indicators', () => {
    const pkg = {
      name: "my-lib",
      exports: { ".": "./dist/index.js" },
      main: "./dist/index.js",
      dependencies: {},
      devDependencies: {},
    };
    const result = detectProjectType(pkg);
    expect(result).toBe("library");
  });

  test('returns "backend" as default', () => {
    const pkg = {
      name: "plain-project",
      dependencies: {},
      devDependencies: {},
    };
    const result = detectProjectType(pkg);
    expect(result).toBe("backend");
  });

  test('returns "backend" when has only backend deps', () => {
    const pkg = {
      name: "api-server",
      dependencies: { hono: "^4.6.0" },
      devDependencies: {},
    };
    const result = detectProjectType(pkg);
    expect(result).toBe("backend");
  });

  test('does not return "library" if has app indicators despite exports', () => {
    const pkg = {
      name: "framework-app",
      exports: { ".": "./dist/index.js" },
      dependencies: { react: "^19.0.0" },
      devDependencies: {},
    };
    const result = detectProjectType(pkg);
    // Should detect frontend indicators, not library
    expect(result).toBe("frontend");
  });
});

// ============================================================================
// detectDependencies
// ============================================================================

describe("detectDependencies", () => {
  test("detects known frameworks from dependencies", () => {
    const pkg = {
      dependencies: { hono: "^4.6.0", zod: "^3.23.0" },
      devDependencies: {},
    };
    const detected = detectDependencies(pkg);
    expect(detected.length).toBeGreaterThanOrEqual(2);
    const names = detected.map((d) => d.framework?.name);
    expect(names).toContain("hono");
    expect(names).toContain("zod");
  });

  test("detects from devDependencies", () => {
    const pkg = {
      dependencies: {},
      devDependencies: { vitest: "^3.0.0" },
    };
    const detected = detectDependencies(pkg);
    expect(detected.length).toBe(1);
    expect(detected[0].framework?.name).toBe("vitest");
  });

  test("skips unknown packages", () => {
    const pkg = {
      dependencies: { "some-unknown-pkg": "^1.0.0" },
      devDependencies: {},
    };
    const detected = detectDependencies(pkg);
    expect(detected.length).toBe(0);
  });

  test("deduplicates framework detections", () => {
    // Both hono and @hono/zod-validator should map to "hono" framework,
    // but should only appear once
    const pkg = {
      dependencies: { hono: "^4.6.0", "@hono/zod-validator": "^0.4.0" },
      devDependencies: {},
    };
    const detected = detectDependencies(pkg);
    const honoDetections = detected.filter((d) => d.framework?.name === "hono");
    expect(honoDetections.length).toBe(1);
  });
});

// ============================================================================
// cleanVersion
// ============================================================================

describe("cleanVersion", () => {
  test('removes ^ prefix: "^1.2.3" -> "1.2.3"', () => {
    expect(cleanVersion("^1.2.3")).toBe("1.2.3");
  });

  test('removes ~ prefix: "~1.2.3" -> "1.2.3"', () => {
    expect(cleanVersion("~1.2.3")).toBe("1.2.3");
  });

  test('removes >= prefix: ">=1.2.3" -> "1.2.3"', () => {
    expect(cleanVersion(">=1.2.3")).toBe("1.2.3");
  });

  test('returns plain version unchanged: "1.2.3" -> "1.2.3"', () => {
    expect(cleanVersion("1.2.3")).toBe("1.2.3");
  });
});

// ============================================================================
// getMajorVersion
// ============================================================================

describe("getMajorVersion", () => {
  test('returns "X.x" for major > 0: "4.2.1" -> "4.x"', () => {
    expect(getMajorVersion("4.2.1")).toBe("4.x");
  });

  test('returns "0.X" for major = 0: "0.3.0" -> "0.3"', () => {
    expect(getMajorVersion("0.3.0")).toBe("0.3");
  });

  test("handles versions with ^ prefix", () => {
    expect(getMajorVersion("^4.6.0")).toBe("4.x");
  });

  test("handles versions with ~ prefix", () => {
    expect(getMajorVersion("~0.44.0")).toBe("0.44");
  });
});

// ============================================================================
// updateFrameworkInConfig
// ============================================================================

describe("updateFrameworkInConfig", () => {
  test("returns new object (immutable update)", () => {
    const original = createConfig({
      frameworks: { hono: createFrameworkConfig() },
    });
    const updated = updateFrameworkInConfig(original, "hono", {
      version: "5.x",
    });
    expect(updated).not.toBe(original);
    expect(original.frameworks.hono.version).toBe("4.x");
    expect(updated.frameworks.hono.version).toBe("5.x");
  });

  test("adds new framework to config", () => {
    const original = createConfig();
    const updated = updateFrameworkInConfig(original, "drizzle", {
      version: "0.44",
      source: "context7",
      lastUpdate: "2026-01-01",
      files: 5,
    });
    expect(updated.frameworks.drizzle).toBeDefined();
    expect(updated.frameworks.drizzle.version).toBe("0.44");
  });
});

// ============================================================================
// removeFrameworkFromConfig
// ============================================================================

describe("removeFrameworkFromConfig", () => {
  test("returns new object without the specified framework", () => {
    const original = createConfig({
      frameworks: {
        hono: createFrameworkConfig(),
        drizzle: createFrameworkConfig({ version: "0.44" }),
      },
    });
    const updated = removeFrameworkFromConfig(original, "hono");
    expect(updated.frameworks.hono).toBeUndefined();
    expect(updated.frameworks.drizzle).toBeDefined();
  });

  test("returns new object (immutable)", () => {
    const original = createConfig({
      frameworks: { hono: createFrameworkConfig() },
    });
    const updated = removeFrameworkFromConfig(original, "hono");
    expect(updated).not.toBe(original);
    expect(original.frameworks.hono).toBeDefined();
  });
});

// ============================================================================
// updateSyncTime
// ============================================================================

describe("updateSyncTime", () => {
  test("returns new object with updated lastSync", () => {
    const original = createConfig({
      sync: { lastSync: null, autoSyncOnInstall: true },
    });
    const updated = updateSyncTime(original);
    expect(updated).not.toBe(original);
    expect(updated.sync.lastSync).not.toBeNull();
    expect(typeof updated.sync.lastSync).toBe("string");
  });

  test("sets lastSync to an ISO date string", () => {
    const original = createConfig();
    const before = new Date().toISOString();
    const updated = updateSyncTime(original);
    const after = new Date().toISOString();
    // The lastSync should be between before and after
    expect(updated.sync.lastSync! >= before).toBe(true);
    expect(updated.sync.lastSync! <= after).toBe(true);
  });

  test("preserves other sync fields", () => {
    const original = createConfig({
      sync: { lastSync: null, autoSyncOnInstall: false },
    });
    const updated = updateSyncTime(original);
    expect(updated.sync.autoSyncOnInstall).toBe(false);
  });
});
