/**
 * Unit Tests: context7.ts
 * Tests the Context7 MCP integration module -- library resolution, query generation,
 * content processing, and batch query helpers.
 *
 * This module is pure logic (no I/O), so no mocking is needed.
 */

import { describe, expect, test } from "bun:test";

import {
  extractRelevantSections,
  generateBatchQueries,
  generateMcpFallbackInstructions,
  generateQueryDocsCall,
  generateResolveLibraryCall,
  generateTemplateQueries,
  processContext7Response,
} from "../../../src/lib/context7.js";

import type { FrameworkTemplate } from "../../../src/lib/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTemplate(
  overrides: Partial<FrameworkTemplate> = {}
): FrameworkTemplate {
  return {
    name: "hono",
    displayName: "Hono",
    version: "4.x",
    source: "context7",
    libraryId: "/honojs/hono",
    category: "backend",
    priority: "P0",
    description: "Fast web framework",
    structure: {
      api: {
        "routing.mdx": { query: "Hono routing", topics: ["routing"] },
        "context.mdx": { query: "Hono context", topics: ["context"] },
      },
      patterns: {
        "middleware.mdx": { query: "Hono middleware", topics: ["middleware"] },
      },
    },
    ...overrides,
  };
}

// ===========================================================================
// generateResolveLibraryCall
// ===========================================================================

describe("generateResolveLibraryCall", () => {
  test("generates correct MCP call JSON", () => {
    const call = generateResolveLibraryCall("hono");
    const parsed = JSON.parse(call);

    expect(parsed.tool).toBe(
      "mcp__plugin_context7_context7__resolve-library-id"
    );
    expect(parsed.params.libraryName).toBe("hono");
  });

  test("handles library names with special characters", () => {
    const call = generateResolveLibraryCall("@tanstack/react-query");
    const parsed = JSON.parse(call);

    expect(parsed.params.libraryName).toBe("@tanstack/react-query");
  });
});

// ===========================================================================
// generateQueryDocsCall
// ===========================================================================

describe("generateQueryDocsCall", () => {
  test("generates correct MCP call JSON with defaults", () => {
    const call = generateQueryDocsCall("/honojs/hono", "routing");
    const parsed = JSON.parse(call);

    expect(parsed.tool).toBe("mcp__plugin_context7_context7__query-docs");
    expect(parsed.params.context7CompatibleLibraryID).toBe("/honojs/hono");
    expect(parsed.params.topic).toBe("routing");
    expect(parsed.params.tokens).toBe(10_000);
  });

  test("uses custom topic and maxTokens from options", () => {
    const call = generateQueryDocsCall("/honojs/hono", "routing", {
      topic: "advanced routing patterns",
      maxTokens: 5000,
    });
    const parsed = JSON.parse(call);

    expect(parsed.params.topic).toBe("advanced routing patterns");
    expect(parsed.params.tokens).toBe(5000);
  });
});

// ===========================================================================
// generateTemplateQueries
// ===========================================================================

describe("generateTemplateQueries", () => {
  test("generates queries from template structure", () => {
    const template = createTemplate();
    const queries = generateTemplateQueries(template);

    expect(queries.length).toBe(3);
    expect(queries[0]).toEqual({
      category: "api",
      file: "routing.mdx",
      query: "Hono routing",
      libraryId: "/honojs/hono",
    });
    expect(queries[1]).toEqual({
      category: "api",
      file: "context.mdx",
      query: "Hono context",
      libraryId: "/honojs/hono",
    });
    expect(queries[2]).toEqual({
      category: "patterns",
      file: "middleware.mdx",
      query: "Hono middleware",
      libraryId: "/honojs/hono",
    });
  });

  test("returns empty array when template has no libraryId", () => {
    const template = createTemplate({ libraryId: undefined });
    const queries = generateTemplateQueries(template);

    expect(queries).toEqual([]);
  });

  test("returns empty array when template has empty structure", () => {
    const template = createTemplate({ structure: {} });
    const queries = generateTemplateQueries(template);

    expect(queries).toEqual([]);
  });
});

// ===========================================================================
// processContext7Response
// ===========================================================================

describe("processContext7Response", () => {
  test("adds frontmatter and preserves content with headings", () => {
    const raw = "# Routing\n\nHono routing docs here.";
    const result = processContext7Response(raw, {
      framework: "hono",
      version: "4.x",
      category: "api",
      file: "routing.mdx",
      libraryId: "/honojs/hono",
    });

    expect(result).toContain("---");
    expect(result).toContain("Part of Passive Docs Index for hono@4.x");
    expect(result).toContain("Source: Context7 (/honojs/hono)");
    expect(result).toContain("Category: api");
    expect(result).toContain("# Routing\n\nHono routing docs here.");
  });

  test("adds heading when content has no heading", () => {
    const raw = "Some content without heading.";
    const result = processContext7Response(raw, {
      framework: "hono",
      version: "4.x",
      category: "api",
      file: "routing.mdx",
    });

    expect(result).toContain("# Routing");
    expect(result).toContain("Some content without heading.");
  });

  test("strips existing frontmatter from raw content", () => {
    const raw = "---\ntitle: Old Title\n---\n\n# Real Content\n\nHere.";
    const result = processContext7Response(raw, {
      framework: "hono",
      version: "4.x",
      category: "api",
      file: "routing.mdx",
    });

    // Should not have "Old Title" in the result frontmatter
    expect(result).not.toContain("Old Title");
    expect(result).toContain("# Real Content");
  });

  test("uses 'manual' when no libraryId provided", () => {
    const result = processContext7Response("# Test", {
      framework: "hono",
      version: "4.x",
      category: "api",
      file: "test.mdx",
    });

    expect(result).toContain("Source: Context7 (manual)");
  });
});

// ===========================================================================
// extractRelevantSections
// ===========================================================================

describe("extractRelevantSections", () => {
  test("returns content unchanged when under maxLength", () => {
    const content = "# Overview\n\nShort content.";
    const result = extractRelevantSections(content, 8000);

    expect(result).toBe(content);
  });

  test("prioritizes overview and quickstart sections", () => {
    const sections = [
      "# Advanced Topics\n\nComplex stuff here with lots of details.",
      "# Overview\n\nImportant intro.",
      "# Getting Started\n\nFirst steps.",
      "# Deep Internals\n\nMore complex details about implementation.",
    ];
    const content = sections.join("\n\n");

    // Set maxLength to only fit 2-3 sections
    const result = extractRelevantSections(content, 100);

    // Overview and Getting Started should be prioritized
    expect(result).toContain("Overview");
  });

  test("truncates to first section if even one section exceeds maxLength", () => {
    const longSection = `# Title\n\n${"x".repeat(10_000)}`;
    const result = extractRelevantSections(longSection, 100);

    expect(result.length).toBeLessThanOrEqual(100);
  });
});

// ===========================================================================
// generateMcpFallbackInstructions
// ===========================================================================

describe("generateMcpFallbackInstructions", () => {
  test("generates MCP fallback with library mappings", () => {
    const result = generateMcpFallbackInstructions({
      hono: "/honojs/hono",
      drizzle: "/drizzle-team/drizzle-orm",
    });

    expect(result).toContain("MCP Fallback Protocol");
    expect(result).toContain("hono: /honojs/hono");
    expect(result).toContain("drizzle: /drizzle-team/drizzle-orm");
    expect(result).toContain("query-docs");
  });

  test("handles empty mappings", () => {
    const result = generateMcpFallbackInstructions({});

    expect(result).toContain("MCP Fallback Protocol");
    expect(result).toContain("Library IDs:");
  });
});

// ===========================================================================
// generateBatchQueries
// ===========================================================================

describe("generateBatchQueries", () => {
  test("generates batch queries from multiple templates", () => {
    const templates = [
      createTemplate(),
      createTemplate({
        name: "drizzle",
        version: "0.30",
        libraryId: "/drizzle-team/drizzle-orm",
        structure: {
          api: {
            "schema.mdx": { query: "Drizzle schema", topics: ["schema"] },
          },
        },
      }),
    ];

    const batches = generateBatchQueries(templates);

    expect(batches.length).toBe(2);
    expect(batches[0].framework).toBe("hono");
    expect(batches[0].queries.length).toBe(3);
    expect(batches[1].framework).toBe("drizzle");
    expect(batches[1].queries.length).toBe(1);
  });

  test("filters out templates without libraryId", () => {
    const templates = [
      createTemplate(),
      createTemplate({ name: "custom", libraryId: undefined }),
    ];

    const batches = generateBatchQueries(templates);

    expect(batches.length).toBe(1);
    expect(batches[0].framework).toBe("hono");
  });

  test("returns empty array for empty templates", () => {
    const batches = generateBatchQueries([]);

    expect(batches).toEqual([]);
  });
});
