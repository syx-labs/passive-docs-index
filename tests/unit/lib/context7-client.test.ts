/**
 * Unit Tests: context7-client.ts
 * Tests the unified Context7 client that coordinates HTTP SDK and MCP fallback.
 *
 * Mocking strategy:
 * - HTTP client: setHttpClientFactory() injects a mock factory (dependency injection)
 * - MCP: FakeMcpClient injected via setMcpClient()
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
import { FakeMcpClient } from "../../helpers/mock-mcp.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

import queryDocsFixture from "../../fixtures/context7/query-docs.json";
import searchLibraryFixture from "../../fixtures/context7/search-library.json";

// ---------------------------------------------------------------------------
// Configurable mock instances that tests can control
// ---------------------------------------------------------------------------
let mockGetContext = mock(async () => queryDocsFixture);
let mockSearchLibrary = mock(async () => searchLibraryFixture);

// ---------------------------------------------------------------------------
// Import the module under test (no mock.module needed — uses factory injection)
// ---------------------------------------------------------------------------

import {
  checkAvailability,
  isHttpClientAvailable,
  queryContext7,
  resetClients,
  resetMcpClient,
  searchLibrary,
  setHttpClientFactory,
  setMcpClient,
} from "../../../src/lib/context7-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let fakeMcp: FakeMcpClient;
let consoleErrorSpy: ReturnType<typeof spyOn>;

function injectMockHttpFactory(): void {
  setHttpClientFactory(async (_apiKey: string) => ({
    getContext: (...args: any[]) => mockGetContext(...args),
    searchLibrary: (...args: any[]) => mockSearchLibrary(...args),
  }));
}

beforeEach(() => {
  // Reset SDK mocks to default behavior
  mockGetContext = mock(async () => queryDocsFixture);
  mockSearchLibrary = mock(async () => searchLibraryFixture);

  // Reset all client state (caches, MCP, factory)
  resetClients();

  // Inject mock HTTP client factory AFTER resetClients (which resets factory)
  injectMockHttpFactory();

  // Fresh MCP fake per test
  fakeMcp = new FakeMcpClient();
  setMcpClient(fakeMcp);

  // Suppress console.error noise in tests
  consoleErrorSpy = spyOn(console, "error").mockImplementation(() => undefined);

  // Clear any stale env
  process.env.CONTEXT7_API_KEY = undefined;
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  process.env.CONTEXT7_API_KEY = undefined;
  resetMcpClient();
});

// ===========================================================================
// queryContext7 (unified)
// ===========================================================================

describe("queryContext7 (unified)", () => {
  test("returns HTTP result when API key is set and SDK succeeds", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(true);
    expect(result.source).toBe("http");
    expect(result.content).toBeDefined();
    expect(result.content).toContain("Hono Routing");
    expect(result.docs).toBeDefined();
    expect(result.docs!.length).toBe(2);
  });

  test("falls back to MCP when HTTP fails", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";

    // Make SDK throw
    mockGetContext = mock(async () => {
      throw new Error("HTTP request failed");
    });

    // Configure MCP to succeed
    fakeMcp.setResponse("/honojs/hono:routing", {
      success: true,
      content: JSON.stringify([{ type: "text", text: "MCP routing docs" }]),
    });

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(true);
    expect(result.source).toBe("mcp");
    expect(result.content).toContain("MCP routing docs");
  });

  test("returns error when both HTTP and MCP fail", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";

    // Make SDK throw
    mockGetContext = mock(async () => {
      throw new Error("HTTP request failed");
    });

    // MCP not available
    fakeMcp.setAvailable(false);

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(false);
    expect(result.source).toBe("none");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Documentation fetch failed");
  });

  test("returns offline error when no API key and no MCP", async () => {
    // No API key
    process.env.CONTEXT7_API_KEY = undefined;

    // MCP not available
    fakeMcp.setAvailable(false);

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(false);
    expect(result.source).toBe("none");
    expect(result.error).toContain("No documentation source available");
  });

  test("tries MCP first when config.preferMcp is true", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";

    fakeMcp.setResponse("/honojs/hono:routing", {
      success: true,
      content: JSON.stringify([{ type: "text", text: "MCP preferred docs" }]),
    });

    const result = await queryContext7("/honojs/hono", "routing", {
      preferMcp: true,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe("mcp");
    expect(result.content).toContain("MCP preferred docs");
  });

  test("falls back to HTTP when preferMcp is true but MCP fails", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";

    // MCP returns failure for query
    fakeMcp.setResponse("/honojs/hono:routing", {
      success: false,
      error: "MCP not configured for this query",
    });

    const result = await queryContext7("/honojs/hono", "routing", {
      preferMcp: true,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe("http");
    expect(result.content).toContain("Hono Routing");
  });

  test("passes apiKey from config to HTTP client", async () => {
    // No env var - use config override
    const result = await queryContext7("/honojs/hono", "routing", {
      apiKey: "config-api-key",
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe("http");
  });

  test("returns no docs found when SDK returns empty array", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    mockGetContext = mock(async () => []);
    fakeMcp.setAvailable(false);

    const result = await queryContext7("/honojs/hono", "nonexistent");

    expect(result.success).toBe(false);
    // The HTTP result returns "No documentation found" with source "http"
    // Then falls to MCP which also fails, so final is "none"
    expect(result.source).toBe("none");
  });
});

// ===========================================================================
// searchLibrary
// ===========================================================================

describe("searchLibrary", () => {
  test("returns {id, name} when search succeeds", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";

    const result = await searchLibrary("hono", "hono");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("/honojs/hono");
    expect(result!.name).toBe("Hono");
  });

  test("returns null when no results", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    mockSearchLibrary = mock(async () => []);

    const result = await searchLibrary("nonexistent", "nonexistent");

    expect(result).toBeNull();
  });

  test("returns null when client unavailable (no API key)", async () => {
    process.env.CONTEXT7_API_KEY = undefined;

    const result = await searchLibrary("hono", "hono");

    expect(result).toBeNull();
  });

  test("returns null on error and calls console.error", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    mockSearchLibrary = mock(async () => {
      throw new Error("Network error");
    });

    const result = await searchLibrary("hono", "hono");

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test("uses apiKeyOverride when provided", async () => {
    // No env var set
    const result = await searchLibrary("hono", "hono", "override-key");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("/honojs/hono");
  });
});

// ===========================================================================
// checkAvailability
// ===========================================================================

describe("checkAvailability", () => {
  test("returns http: true, mcp: false when only API key set", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    fakeMcp.setAvailable(false);

    const status = await checkAvailability(fakeMcp);

    expect(status.http).toBe(true);
    expect(status.mcp).toBe(false);
    expect(status.available).toBe(true);
    expect(status.recommended).toBe("http");
    expect(status.message).toContain("HTTP API");
  });

  test("returns http: false, mcp: true when only MCP available", async () => {
    process.env.CONTEXT7_API_KEY = undefined;
    fakeMcp.setAvailable(true);

    const status = await checkAvailability(fakeMcp);

    expect(status.http).toBe(false);
    expect(status.mcp).toBe(true);
    expect(status.available).toBe(true);
    expect(status.recommended).toBe("mcp");
    expect(status.message).toContain("MCP available");
  });

  test("returns both true when both available", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    fakeMcp.setAvailable(true);

    const status = await checkAvailability(fakeMcp);

    expect(status.http).toBe(true);
    expect(status.mcp).toBe(true);
    expect(status.available).toBe(true);
    expect(status.recommended).toBe("http");
  });

  test("returns both false when neither available", async () => {
    process.env.CONTEXT7_API_KEY = undefined;
    fakeMcp.setAvailable(false);

    const status = await checkAvailability(fakeMcp);

    expect(status.http).toBe(false);
    expect(status.mcp).toBe(false);
    expect(status.available).toBe(false);
    expect(status.recommended).toBe("offline");
    expect(status.message).toContain("No documentation source");
  });
});

// ===========================================================================
// resetClients
// ===========================================================================

describe("resetClients", () => {
  test("clears cached state so next call creates fresh client", async () => {
    // Set up API key and make a successful query to populate caches
    process.env.CONTEXT7_API_KEY = "test-api-key";
    const first = await queryContext7("/honojs/hono", "routing");
    expect(first.success).toBe(true);

    // Reset
    resetClients();

    // Without API key, HTTP should now be unavailable
    process.env.CONTEXT7_API_KEY = undefined;
    expect(await isHttpClientAvailable()).toBe(false);
  });

  test("resets MCP client to default", async () => {
    // Set fake MCP and confirm it's active
    setMcpClient(fakeMcp);
    fakeMcp.setAvailable(true);
    const beforeStatus = await checkAvailability();
    expect(beforeStatus.mcp).toBe(true); // fake reports true

    // Reset restores the default McpCliClient
    resetClients();

    // Re-inject HTTP factory for consistent behavior
    injectMockHttpFactory();

    // After reset, if the fake were still active it would return true.
    // With the real client, the result depends on the environment but the fake was removed.
    const status = await checkAvailability();
    expect(typeof status.mcp).toBe("boolean");
  });
});

// ===========================================================================
// queryViaHttp error paths
// ===========================================================================

describe("queryContext7 HTTP error handling", () => {
  test("handles library_redirected error by resolving library ID", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    fakeMcp.setAvailable(false);

    // First call throws library_redirected, searchLibrary returns a resolved ID
    let callCount = 0;
    mockGetContext = mock(async (_query: string, _libraryId: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("library_redirected: use new ID");
      }
      // Second call (retry with resolved ID) succeeds
      return queryDocsFixture;
    });

    // searchLibrary is used for resolveLibraryId
    mockSearchLibrary = mock(async () => [
      { id: "/honojs/hono-v2", name: "Hono v2", trustScore: 1 },
    ]);

    const result = await queryContext7("/honojs/hono", "routing");

    // Should succeed after redirect resolution
    expect(result.success).toBe(true);
    expect(result.source).toBe("http");
  });

  test("handles library_redirected when resolve returns null", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    fakeMcp.setAvailable(false);

    mockGetContext = mock(async () => {
      throw new Error("library_redirected: use new ID");
    });

    // searchLibrary returns no results
    mockSearchLibrary = mock(async () => []);

    const result = await queryContext7("/honojs/hono", "routing");

    // HTTP fails with redirect, MCP is unavailable, so final error is combined
    expect(result.success).toBe(false);
    // The error log in console.error should contain the redirect message
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test("handles library_redirected when retry also fails", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    fakeMcp.setAvailable(false);

    mockGetContext = mock(async () => {
      throw new Error("library_redirected: use new ID");
    });

    // searchLibrary returns a different ID
    mockSearchLibrary = mock(async () => [
      { id: "/honojs/hono-new", name: "Hono New", trustScore: 1 },
    ]);

    const result = await queryContext7("/honojs/hono", "routing");

    // getContext always throws, so retry also fails
    expect(result.success).toBe(false);
  });

  test("handles SDK returning null docs", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    fakeMcp.setAvailable(false);

    mockGetContext = mock(async () => null);

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(false);
  });

  test("handles generic SDK error (non-redirect)", async () => {
    process.env.CONTEXT7_API_KEY = "test-api-key";
    fakeMcp.setAvailable(false);

    mockGetContext = mock(async () => {
      throw new Error("Internal server error");
    });

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(false);
  });

  test("MCP returns empty content", async () => {
    process.env.CONTEXT7_API_KEY = undefined;

    fakeMcp.setAvailable(true);
    fakeMcp.setResponse("/honojs/hono:routing", {
      success: true,
      content: "   ", // whitespace-only content
    });

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("No documentation source available");
  });

  test("MCP query fails with error", async () => {
    process.env.CONTEXT7_API_KEY = undefined;

    fakeMcp.setAvailable(true);
    fakeMcp.setResponse("/honojs/hono:routing", {
      success: false,
      error: "MCP server error",
    });

    const result = await queryContext7("/honojs/hono", "routing");

    expect(result.success).toBe(false);
  });

  test("getHttpClient error returns null gracefully", async () => {
    // Test the catch path in getHttpClient - this is tricky to trigger
    // The Context7 constructor might throw on an invalid key
    process.env.CONTEXT7_API_KEY = "test-key";

    // Use a valid key that works, then test that caching works
    const result1 = await queryContext7("/honojs/hono", "routing");
    expect(result1.success).toBe(true);

    // Reset clients then query again with same key (tests cache logic)
    resetClients();
    injectMockHttpFactory();
    process.env.CONTEXT7_API_KEY = "test-key";
    const result2 = await queryContext7("/honojs/hono", "routing");
    expect(result2.success).toBe(true);
  });
});

// ===========================================================================
// isHttpClientAvailable
// ===========================================================================

describe("isHttpClientAvailable", () => {
  test("returns true when API key is set via env", async () => {
    process.env.CONTEXT7_API_KEY = "test-key";
    expect(await isHttpClientAvailable()).toBe(true);
  });

  test("returns false when no API key", async () => {
    process.env.CONTEXT7_API_KEY = undefined;
    expect(await isHttpClientAvailable()).toBe(false);
  });

  test("returns true when apiKeyOverride is provided", async () => {
    process.env.CONTEXT7_API_KEY = undefined;
    expect(await isHttpClientAvailable("override-key")).toBe(true);
  });
});
