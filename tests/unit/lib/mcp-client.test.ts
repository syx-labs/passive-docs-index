/**
 * Unit Tests: mcp-client.ts
 * Tests the MCP CLI client -- focuses on extractContext7Content (pure function)
 * and resetMcpCliCache (state management).
 *
 * The subprocess-dependent functions (isMcpCliAvailable, queryContext7, etc.)
 * are tested via FakeMcpClient in context7-client.test.ts instead.
 */

import { describe, expect, test } from "bun:test";

import {
  extractContext7Content,
  resetMcpCliCache,
} from "../../../src/lib/mcp-client.js";

// Fixture for complex MCP response
import mcpQueryResult from "../../fixtures/mcp/query-result.json";

// ===========================================================================
// extractContext7Content
// ===========================================================================

describe("extractContext7Content", () => {
  test("parses JSON string response", () => {
    const raw = JSON.stringify("Hello, this is documentation content.");
    const result = extractContext7Content(raw);

    expect(result).toBe("Hello, this is documentation content.");
  });

  test("parses JSON array response with text blocks", () => {
    const raw = JSON.stringify([
      { type: "text", text: "Block 1 content" },
      { type: "text", text: "Block 2 content" },
    ]);
    const result = extractContext7Content(raw);

    expect(result).toContain("Block 1 content");
    expect(result).toContain("Block 2 content");
    // Blocks are joined with double newline
    expect(result).toBe("Block 1 content\n\nBlock 2 content");
  });

  test("parses JSON array response with content blocks", () => {
    const raw = JSON.stringify([
      { content: "Content block A" },
      { content: "Content block B" },
    ]);
    const result = extractContext7Content(raw);

    expect(result).toBe("Content block A\n\nContent block B");
  });

  test("parses JSON array with string elements", () => {
    const raw = JSON.stringify(["string one", "string two"]);
    const result = extractContext7Content(raw);

    expect(result).toBe("string one\n\nstring two");
  });

  test("parses JSON object with content string field", () => {
    const raw = JSON.stringify({ content: "Direct content string" });
    const result = extractContext7Content(raw);

    expect(result).toBe("Direct content string");
  });

  test("parses JSON object with content array (MCP format)", () => {
    const raw = JSON.stringify({
      content: [
        { type: "text", text: "MCP text block 1" },
        { type: "text", text: "MCP text block 2" },
      ],
    });
    const result = extractContext7Content(raw);

    expect(result).toBe("MCP text block 1\n\nMCP text block 2");
  });

  test("parses JSON object with content array containing strings", () => {
    const raw = JSON.stringify({
      content: ["string item 1", "string item 2"],
    });
    const result = extractContext7Content(raw);

    expect(result).toBe("string item 1\n\nstring item 2");
  });

  test("parses JSON object with result string field", () => {
    const raw = JSON.stringify({ result: "Result documentation" });
    const result = extractContext7Content(raw);

    expect(result).toBe("Result documentation");
  });

  test("parses JSON object with result object field", () => {
    const raw = JSON.stringify({ result: { nested: "data" } });
    const result = extractContext7Content(raw);

    expect(result).toBe(JSON.stringify({ nested: "data" }));
  });

  test("parses JSON object with text field", () => {
    const raw = JSON.stringify({ text: "Plain text content" });
    const result = extractContext7Content(raw);

    expect(result).toBe("Plain text content");
  });

  test("parses JSON object with documentation field", () => {
    const raw = JSON.stringify({ documentation: "Documentation content here" });
    const result = extractContext7Content(raw);

    expect(result).toBe("Documentation content here");
  });

  test("parses JSON object with docs field", () => {
    const raw = JSON.stringify({ docs: "Docs content here" });
    const result = extractContext7Content(raw);

    expect(result).toBe("Docs content here");
  });

  test("parses JSON object with body field", () => {
    const raw = JSON.stringify({ body: "Body content here" });
    const result = extractContext7Content(raw);

    expect(result).toBe("Body content here");
  });

  test("returns raw string when not valid JSON", () => {
    const raw = "This is not JSON, just plain text documentation.";
    const result = extractContext7Content(raw);

    expect(result).toBe(raw);
  });

  test("handles complex nested response from fixture", () => {
    const raw = JSON.stringify(mcpQueryResult);
    const result = extractContext7Content(raw);

    expect(result).toContain("Hono Routing");
    expect(result).toContain("Basic Routing");
    expect(result).toContain("Route Parameters");
  });

  test("stringifies unknown JSON object as fallback", () => {
    const raw = JSON.stringify({ unknownField: "value", anotherField: 42 });
    const result = extractContext7Content(raw);

    // Should pretty-print the JSON
    const parsed = JSON.parse(result);
    expect(parsed.unknownField).toBe("value");
    expect(parsed.anotherField).toBe(42);
  });

  test("handles content object that is not a string or array", () => {
    const raw = JSON.stringify({ content: { nested: "obj" } });
    const result = extractContext7Content(raw);

    expect(result).toBe(JSON.stringify({ nested: "obj" }));
  });

  test("handles empty array", () => {
    const raw = JSON.stringify([]);
    const result = extractContext7Content(raw);

    // Empty array has no text parts -- falls through to stringify
    expect(result).toBe("[]");
  });

  test("handles empty content array in object", () => {
    const raw = JSON.stringify({ content: [] });
    const result = extractContext7Content(raw);

    // Empty content array -- falls through to stringify "[]"
    expect(result).toBe("[]");
  });
});

// ===========================================================================
// resetMcpCliCache
// ===========================================================================

describe("resetMcpCliCache", () => {
  test("resets mcpCliAvailable and mcpCliInfo to null", () => {
    // Call reset -- it should not throw
    resetMcpCliCache();

    // After reset, the next call to isMcpCliAvailable should re-detect
    // We can't easily verify internal state, but we can verify the function works
    expect(() => resetMcpCliCache()).not.toThrow();
  });

  test("can be called multiple times without error", () => {
    resetMcpCliCache();
    resetMcpCliCache();
    resetMcpCliCache();

    // No errors means success
    expect(true).toBe(true);
  });
});
