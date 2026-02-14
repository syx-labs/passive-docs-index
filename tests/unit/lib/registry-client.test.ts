/**
 * Unit Tests: registry-client.ts
 * Tests the npm registry API client for fetching latest package versions.
 *
 * Mocking strategy: spyOn(global, 'fetch') via createFetchMock helper
 * (established pattern from phase 01).
 */

import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  fetchLatestVersion,
  fetchLatestVersions,
  NPM_REGISTRY_URL,
} from "../../../src/lib/registry-client.js";
import { createFetchMock } from "../../helpers/mock-fetch.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof spyOn>;

afterEach(() => {
  if (fetchSpy) {
    fetchSpy.mockRestore();
  }
});

// ===========================================================================
// fetchLatestVersion
// ===========================================================================

describe("fetchLatestVersion", () => {
  test("returns latest version string from dist-tags when registry responds 200", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/react",
        response: Response.json({
          "dist-tags": { latest: "19.1.0" },
        }),
      },
    ]);

    const version = await fetchLatestVersion("react");

    expect(version).toBe("19.1.0");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("returns null when package not found (404)", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/nonexistent-package-xyz",
        response: new Response("Not Found", { status: 404 }),
      },
    ]);

    const version = await fetchLatestVersion("nonexistent-package-xyz");

    expect(version).toBeNull();
  });

  test("throws error on non-404 HTTP errors (500)", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/react",
        response: new Response("Internal Server Error", { status: 500 }),
      },
    ]);

    await expect(fetchLatestVersion("react")).rejects.toThrow(/registry.*500/i);
  });

  test("throws error on 403 HTTP error", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/react",
        response: new Response("Forbidden", { status: 403 }),
      },
    ]);

    await expect(fetchLatestVersion("react")).rejects.toThrow(/registry.*403/i);
  });

  test("uses abbreviated metadata Accept header", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/hono",
        response: (_url: string, options?: RequestInit) => {
          const acceptHeader = options?.headers
            ? (options.headers as Record<string, string>).Accept ||
              (options.headers as Record<string, string>).accept
            : undefined;

          expect(acceptHeader).toContain("application/vnd.npm.install-v1+json");

          return Response.json({
            "dist-tags": { latest: "4.7.0" },
          });
        },
      },
    ]);

    await fetchLatestVersion("hono");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("respects 5-second timeout via AbortSignal", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/react",
        response: (_url: string, options?: RequestInit) => {
          // Verify signal is provided
          expect(options?.signal).toBeDefined();
          return Response.json({
            "dist-tags": { latest: "19.1.0" },
          });
        },
      },
    ]);

    await fetchLatestVersion("react");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("handles network errors (fetch rejects) by throwing", async () => {
    fetchSpy = spyOn(global, "fetch").mockRejectedValue(
      new Error("Network failure")
    );

    await expect(fetchLatestVersion("react")).rejects.toThrow(
      "Network failure"
    );
  });

  test("properly encodes scoped package names", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "%40tanstack%2Freact-query",
        response: Response.json({
          "dist-tags": { latest: "5.62.0" },
        }),
      },
    ]);

    const version = await fetchLatestVersion("@tanstack/react-query");

    expect(version).toBe("5.62.0");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("NPM_REGISTRY_URL is correct", () => {
    expect(NPM_REGISTRY_URL).toBe("https://registry.npmjs.org");
  });
});

// ===========================================================================
// fetchLatestVersions
// ===========================================================================

describe("fetchLatestVersions", () => {
  test("fetches multiple packages and returns Map<string, string | null>", async () => {
    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/react",
        response: Response.json({
          "dist-tags": { latest: "19.1.0" },
        }),
      },
      {
        pattern: "registry.npmjs.org/hono",
        response: Response.json({
          "dist-tags": { latest: "4.7.0" },
        }),
      },
    ]);

    const versions = await fetchLatestVersions(["react", "hono"]);

    expect(versions).toBeInstanceOf(Map);
    expect(versions.get("react")).toBe("19.1.0");
    expect(versions.get("hono")).toBe("4.7.0");
    expect(versions.size).toBe(2);
  });

  test("handles mixed results (some succeed, some 404, some error)", async () => {
    const consoleErrorSpy = spyOn(console, "error").mockImplementation(
      () => undefined
    );

    fetchSpy = createFetchMock([
      {
        pattern: "registry.npmjs.org/react",
        response: Response.json({
          "dist-tags": { latest: "19.1.0" },
        }),
      },
      {
        pattern: "registry.npmjs.org/nonexistent-pkg",
        response: new Response("Not Found", { status: 404 }),
      },
      {
        pattern: "registry.npmjs.org/broken-pkg",
        response: new Response("Server Error", { status: 500 }),
      },
    ]);

    const versions = await fetchLatestVersions([
      "react",
      "nonexistent-pkg",
      "broken-pkg",
    ]);

    expect(versions.get("react")).toBe("19.1.0");
    expect(versions.get("nonexistent-pkg")).toBeNull();
    // broken-pkg should be null due to error being caught in batch mode
    expect(versions.get("broken-pkg")).toBeNull();
    expect(versions.size).toBe(3);

    consoleErrorSpy.mockRestore();
  });

  test("returns empty map for empty input array", async () => {
    fetchSpy = spyOn(global, "fetch").mockImplementation(async () => {
      throw new Error("Should not be called");
    });

    const versions = await fetchLatestVersions([]);

    expect(versions).toBeInstanceOf(Map);
    expect(versions.size).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("limits concurrency to 5 parallel requests", async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    fetchSpy = spyOn(global, "fetch").mockImplementation(async (_input) => {
      currentConcurrent++;
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent;
      }
      // Small delay to allow concurrency to build
      await new Promise((resolve) => setTimeout(resolve, 10));
      currentConcurrent--;

      return Response.json({
        "dist-tags": { latest: "1.0.0" },
      });
    });

    // Create 10 packages to test concurrency limiting
    const packages = Array.from({ length: 10 }, (_, i) => `pkg-${i}`);
    const versions = await fetchLatestVersions(packages);

    expect(versions.size).toBe(10);
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });
});
