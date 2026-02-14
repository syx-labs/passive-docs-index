/**
 * Unit Tests: freshness.ts
 * Tests the freshness checking logic for indexed framework documentation.
 *
 * Mocking strategy:
 * - Dependency injection via fetchVersionsFn parameter on checkFreshness
 * - No mock.module needed (avoids Bun module cache pollution)
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
  checkFreshness,
  checkVersionFreshness,
  EXIT_CODES,
} from "../../../src/lib/freshness.js";
import {
  createConfig,
  createFrameworkConfig,
} from "../../helpers/factories.js";

// ---------------------------------------------------------------------------
// Mock fetch function (injected via DI, no mock.module needed)
// ---------------------------------------------------------------------------

const mockFetchLatestVersions = mock(
  async (_names: string[]): Promise<Map<string, string | null>> => new Map()
);

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetchLatestVersions.mockReset();
  mockFetchLatestVersions.mockImplementation(async () => new Map());
  consoleErrorSpy = spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ===========================================================================
// EXIT_CODES
// ===========================================================================

describe("EXIT_CODES", () => {
  test("SUCCESS = 0", () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  test("STALE = 1", () => {
    expect(EXIT_CODES.STALE).toBe(1);
  });

  test("MISSING = 2", () => {
    expect(EXIT_CODES.MISSING).toBe(2);
  });

  test("ORPHANED = 3", () => {
    expect(EXIT_CODES.ORPHANED).toBe(3);
  });

  test("MIXED = 4", () => {
    expect(EXIT_CODES.MIXED).toBe(4);
  });

  test("NETWORK_ERROR = 5", () => {
    expect(EXIT_CODES.NETWORK_ERROR).toBe(5);
  });
});

// ===========================================================================
// checkVersionFreshness
// ===========================================================================

describe("checkVersionFreshness", () => {
  test('returns { isStale: true, diffType: "major" } for 18.0.0 -> 19.0.0', () => {
    const result = checkVersionFreshness("18.0.0", "19.0.0");
    expect(result.isStale).toBe(true);
    expect(result.diffType).toBe("major");
  });

  test('returns { isStale: true, diffType: "minor" } for 18.0.0 -> 18.3.0', () => {
    const result = checkVersionFreshness("18.0.0", "18.3.0");
    expect(result.isStale).toBe(true);
    expect(result.diffType).toBe("minor");
  });

  test('returns { isStale: false, diffType: "patch" } for 18.2.0 -> 18.2.1', () => {
    const result = checkVersionFreshness("18.2.0", "18.2.1");
    expect(result.isStale).toBe(false);
    expect(result.diffType).toBe("patch");
  });

  test("returns { isStale: false, diffType: null } for same version", () => {
    const result = checkVersionFreshness("18.0.0", "18.0.0");
    expect(result.isStale).toBe(false);
    expect(result.diffType).toBeNull();
  });

  test('handles loose versions via semver.coerce: "18.x" -> 18.0.0', () => {
    const result = checkVersionFreshness("18.x", "19.0.0");
    expect(result.isStale).toBe(true);
    expect(result.diffType).toBe("major");
  });

  test('handles loose versions via semver.coerce: "v19" -> 19.0.0', () => {
    const result = checkVersionFreshness("18.0.0", "v19");
    expect(result.isStale).toBe(true);
    expect(result.diffType).toBe("major");
  });

  test('handles loose versions via semver.coerce: "4" -> 4.0.0', () => {
    const result = checkVersionFreshness("3.0.0", "4");
    expect(result.isStale).toBe(true);
    expect(result.diffType).toBe("major");
  });

  test('returns { isStale: false, diffType: "uncoercible" } for un-coercible versions', () => {
    const result = checkVersionFreshness("not-a-version", "also-not-a-version");
    expect(result.isStale).toBe(false);
    expect(result.diffType).toBe("uncoercible");
  });

  test('returns { isStale: false, diffType: "uncoercible" } when only indexed version is un-coercible', () => {
    const result = checkVersionFreshness("latest", "19.0.0");
    expect(result.isStale).toBe(false);
    expect(result.diffType).toBe("uncoercible");
  });

  test('returns { isStale: false, diffType: "uncoercible" } when only latest version is un-coercible', () => {
    const result = checkVersionFreshness("19.0.0", "latest");
    expect(result.isStale).toBe(false);
    expect(result.diffType).toBe("uncoercible");
  });
});

// ===========================================================================
// checkFreshness
// ===========================================================================

describe("checkFreshness", () => {
  test('reports "up-to-date" for frameworks where indexed version matches latest', async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "19.0.0" }),
      },
    });
    const packageJson = {
      dependencies: { react: "^19.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map([["react", "19.0.0"]]));

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results).toHaveLength(1);
    expect(output.results[0].status).toBe("up-to-date");
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output.summary.upToDate).toBe(1);
    expect(output.summary.unknown).toBe(0);
  });

  test('reports "stale" for frameworks where latest has new major version', async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "18.0.0" }),
      },
    });
    const packageJson = {
      dependencies: { react: "^18.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map([["react", "19.1.0"]]));

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results.find((r) => r.framework === "react")?.status).toBe(
      "stale"
    );
    expect(output.exitCode).toBe(EXIT_CODES.STALE);
    expect(output.summary.stale).toBe(1);
  });

  test('reports "stale" for frameworks where latest has new minor version', async () => {
    const config = createConfig({
      frameworks: {
        hono: createFrameworkConfig({ version: "4.0.0" }),
      },
    });
    const packageJson = {
      dependencies: { hono: "^4.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map([["hono", "4.7.0"]]));

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results.find((r) => r.framework === "hono")?.status).toBe(
      "stale"
    );
    expect(output.exitCode).toBe(EXIT_CODES.STALE);
  });

  test('reports "orphaned" for frameworks in config but NOT in package.json', async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "19.0.0" }),
      },
    });
    const packageJson = {
      dependencies: {},
    };

    mockFetchLatestVersions.mockResolvedValue(new Map([["react", "19.0.0"]]));

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results.find((r) => r.framework === "react")?.status).toBe(
      "orphaned"
    );
    expect(output.exitCode).toBe(EXIT_CODES.ORPHANED);
    expect(output.summary.orphaned).toBe(1);
  });

  test('reports "missing" for frameworks in package.json but NOT in config', async () => {
    const config = createConfig({
      frameworks: {},
    });
    const packageJson = {
      dependencies: { hono: "^4.7.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map());

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results.find((r) => r.framework === "hono")?.status).toBe(
      "missing"
    );
    expect(output.exitCode).toBe(EXIT_CODES.MISSING);
    expect(output.summary.missing).toBe(1);
  });

  test('reports "unknown" when registry returns null for a known framework', async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "19.0.0" }),
      },
    });
    const packageJson = {
      dependencies: { react: "^19.0.0" },
    };

    // Registry returns null for react (e.g., fetch failed for this package)
    mockFetchLatestVersions.mockResolvedValue(new Map([["react", null]]));

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results[0].status).toBe("unknown");
    expect(output.results[0].diffType).toBe("fetch-failed");
    expect(output.results[0].latestVersion).toBeNull();
    expect(output.summary.unknown).toBe(1);
    expect(output.summary.upToDate).toBe(0);
    // unknown alone should not cause a non-zero exit code
    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  test("handles frameworks with no npm package mapping (timestamp-based check)", async () => {
    const thirtyOneDaysAgo = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000
    ).toISOString();

    const config = createConfig({
      frameworks: {
        "custom-framework": createFrameworkConfig({
          version: "1.0.0",
          lastUpdate: thirtyOneDaysAgo,
        }),
      },
    });
    const packageJson = {
      dependencies: { "custom-framework": "^1.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map());

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    const customResult = output.results.find(
      (r) => r.framework === "custom-framework"
    );
    expect(customResult?.status).toBe("stale");
  });

  test("timestamp-based check uses configurable staleDays", async () => {
    const tenDaysAgo = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    ).toISOString();

    const config = createConfig({
      frameworks: {
        "custom-framework": createFrameworkConfig({
          version: "1.0.0",
          lastUpdate: tenDaysAgo,
        }),
      },
    });
    const packageJson = {
      dependencies: { "custom-framework": "^1.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map());

    // staleDays = 7 means 10 days old is stale
    const output = await checkFreshness(config, packageJson, {
      staleDays: 7,
      fetchVersionsFn: mockFetchLatestVersions,
    });

    const customResult = output.results.find(
      (r) => r.framework === "custom-framework"
    );
    expect(customResult?.status).toBe("stale");
  });

  test("timestamp-based check reports up-to-date when within staleDays", async () => {
    const fiveDaysAgo = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000
    ).toISOString();

    const config = createConfig({
      frameworks: {
        "custom-framework": createFrameworkConfig({
          version: "1.0.0",
          lastUpdate: fiveDaysAgo,
        }),
      },
    });
    const packageJson = {
      dependencies: { "custom-framework": "^1.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map());

    const output = await checkFreshness(config, packageJson, {
      staleDays: 30,
      fetchVersionsFn: mockFetchLatestVersions,
    });

    const customResult = output.results.find(
      (r) => r.framework === "custom-framework"
    );
    expect(customResult?.status).toBe("up-to-date");
  });

  test("returns correct exit code SUCCESS for all ok", async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "19.0.0" }),
        hono: createFrameworkConfig({ version: "4.7.0" }),
      },
    });
    const packageJson = {
      dependencies: { react: "^19.0.0", hono: "^4.7.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(
      new Map([
        ["react", "19.0.0"],
        ["hono", "4.7.0"],
      ])
    );

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output.summary.total).toBe(2);
    expect(output.summary.upToDate).toBe(2);
  });

  test("returns MIXED exit code when multiple problem types exist", async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "18.0.0" }),
        // vue is in config but not in package.json -> orphaned
        vue: createFrameworkConfig({ version: "3.0.0" }),
      },
    });
    const packageJson = {
      dependencies: {
        react: "^18.0.0",
        // hono in deps but not in config -> missing
        hono: "^4.7.0",
      },
    };

    mockFetchLatestVersions.mockResolvedValue(
      new Map([
        ["react", "19.1.0"], // stale
        ["vue", "3.5.0"],
      ])
    );

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    // We have stale (react), orphaned (vue), and missing (hono)
    expect(output.exitCode).toBe(EXIT_CODES.MIXED);
  });

  test("returns NETWORK_ERROR when registry fetch fails", async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "19.0.0" }),
      },
    });
    const packageJson = {
      dependencies: { react: "^19.0.0" },
    };

    mockFetchLatestVersions.mockRejectedValue(
      new Error("Network error: unable to reach registry")
    );

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.exitCode).toBe(EXIT_CODES.NETWORK_ERROR);
  });

  test("handles null packageJson gracefully (all config frameworks become orphaned)", async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "19.0.0" }),
      },
    });

    mockFetchLatestVersions.mockResolvedValue(new Map([["react", "19.0.0"]]));

    const output = await checkFreshness(config, null, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results.find((r) => r.framework === "react")?.status).toBe(
      "orphaned"
    );
    expect(output.exitCode).toBe(EXIT_CODES.ORPHANED);
  });

  test("detects missing frameworks from devDependencies too", async () => {
    const config = createConfig({
      frameworks: {},
    });
    const packageJson = {
      devDependencies: { vitest: "^2.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map());

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.results.find((r) => r.framework === "vitest")?.status).toBe(
      "missing"
    );
    expect(output.summary.missing).toBe(1);
  });

  test("summary counts are correct with mixed statuses", async () => {
    const config = createConfig({
      frameworks: {
        react: createFrameworkConfig({ version: "19.0.0" }),
        hono: createFrameworkConfig({ version: "3.0.0" }),
      },
    });
    const packageJson = {
      dependencies: {
        react: "^19.0.0",
        hono: "^3.0.0",
        zod: "^3.0.0",
      },
    };

    mockFetchLatestVersions.mockResolvedValue(
      new Map([
        ["react", "19.0.0"], // up-to-date
        ["hono", "4.7.0"], // stale (major)
      ])
    );

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(output.summary.upToDate).toBe(1); // react
    expect(output.summary.stale).toBe(1); // hono
    expect(output.summary.missing).toBe(1); // zod
    expect(output.summary.orphaned).toBe(0);
    expect(output.summary.unknown).toBe(0);
    expect(output.summary.total).toBe(3);
  });

  test("handles scoped package detection for missing frameworks", async () => {
    const config = createConfig({
      frameworks: {},
    });
    const packageJson = {
      dependencies: { "@tanstack/react-query": "^5.0.0" },
    };

    mockFetchLatestVersions.mockResolvedValue(new Map());

    const output = await checkFreshness(config, packageJson, {
      fetchVersionsFn: mockFetchLatestVersions,
    });

    expect(
      output.results.find((r) => r.framework === "tanstack-query")?.status
    ).toBe("missing");
  });
});
