/**
 * Unit tests for Context7 error classification
 *
 * Tests classifyContext7Error() with various error patterns.
 */

import { describe, expect, test } from "bun:test";
import { classifyContext7Error } from "../../../src/lib/context7-client.js";
import { Context7Error, PDIError } from "../../../src/lib/errors.js";

// ============================================================================
// Auth errors
// ============================================================================

describe("classifyContext7Error - auth", () => {
  test("classifies HTTP 401 as auth error", () => {
    const result = classifyContext7Error(
      new Error("HTTP 401 Unauthorized"),
      "http"
    );
    expect(result.category).toBe("auth");
    expect(result.hint).toContain("pdi auth");
  });

  test("classifies 403 Forbidden as auth error", () => {
    const result = classifyContext7Error(new Error("403 Forbidden"), "http");
    expect(result.category).toBe("auth");
  });

  test("classifies invalid API key as auth error", () => {
    const result = classifyContext7Error(
      new Error("Invalid API key provided"),
      "http"
    );
    expect(result.category).toBe("auth");
  });
});

// ============================================================================
// Rate limit errors
// ============================================================================

describe("classifyContext7Error - rate_limit", () => {
  test("classifies HTTP 429 as rate limit", () => {
    const result = classifyContext7Error(
      new Error("429 Too Many Requests"),
      "http"
    );
    expect(result.category).toBe("rate_limit");
    expect(result.hint).toContain("Wait");
  });

  test("classifies rate limit exceeded as rate limit", () => {
    const result = classifyContext7Error(
      new Error("Rate limit exceeded"),
      "http"
    );
    expect(result.category).toBe("rate_limit");
  });
});

// ============================================================================
// Network errors
// ============================================================================

describe("classifyContext7Error - network", () => {
  test("classifies fetch failed as network error", () => {
    const result = classifyContext7Error(new Error("fetch failed"), "http");
    expect(result.category).toBe("network");
    expect(result.hint).toContain("internet connection");
  });

  test("classifies ECONNREFUSED as network error", () => {
    const result = classifyContext7Error(new Error("ECONNREFUSED"), "http");
    expect(result.category).toBe("network");
  });

  test("classifies timeout as network error", () => {
    const result = classifyContext7Error(new Error("Request timeout"), "http");
    expect(result.category).toBe("network");
  });

  test("classifies TypeError fetch as network error", () => {
    const result = classifyContext7Error(
      new TypeError("Failed to fetch"),
      "http"
    );
    expect(result.category).toBe("network");
  });
});

// ============================================================================
// Redirect errors
// ============================================================================

describe("classifyContext7Error - redirect", () => {
  test("classifies library_redirected as redirect", () => {
    const result = classifyContext7Error(
      new Error("library_redirected to /new/id"),
      "http"
    );
    expect(result.category).toBe("redirect");
    expect(result.hint).toContain("--force");
  });
});

// ============================================================================
// Not found errors
// ============================================================================

describe("classifyContext7Error - not_found", () => {
  test("classifies no documentation found as not_found", () => {
    const result = classifyContext7Error(
      new Error("No documentation found"),
      "http"
    );
    expect(result.category).toBe("not_found");
  });

  test("classifies 404 as not_found", () => {
    const result = classifyContext7Error(new Error("404 Not Found"), "http");
    expect(result.category).toBe("not_found");
  });
});

// ============================================================================
// Unknown errors
// ============================================================================

describe("classifyContext7Error - unknown", () => {
  test("classifies unrecognized error as unknown", () => {
    const result = classifyContext7Error(
      new Error("Something unexpected"),
      "http"
    );
    expect(result.category).toBe("unknown");
    expect(result.message).toBe("Something unexpected");
  });

  test("handles string errors", () => {
    const result = classifyContext7Error("string error", "mcp");
    expect(result.category).toBe("unknown");
    expect(result.message).toBe("string error");
  });
});

// ============================================================================
// Common properties
// ============================================================================

describe("classifyContext7Error - common properties", () => {
  test("all classified errors are instanceof Context7Error", () => {
    const result = classifyContext7Error(new Error("test"), "http");
    expect(result).toBeInstanceOf(Context7Error);
  });

  test("all classified errors are instanceof PDIError", () => {
    const result = classifyContext7Error(new Error("test"), "http");
    expect(result).toBeInstanceOf(PDIError);
  });

  test("preserves source property", () => {
    const httpResult = classifyContext7Error(new Error("test"), "http");
    expect(httpResult.source).toBe("http");

    const mcpResult = classifyContext7Error(new Error("test"), "mcp");
    expect(mcpResult.source).toBe("mcp");
  });

  test("preserves original error as cause", () => {
    const original = new Error("original error");
    const result = classifyContext7Error(original, "http");
    expect(result.cause).toBe(original);
  });
});
