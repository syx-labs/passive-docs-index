/**
 * Unit tests for src/lib/index-parser.ts
 *
 * Tests all exported functions: parseIndex, generateIndex, generateIndexBlock,
 * extractIndexFromClaudeMd, updateClaudeMdIndex, buildIndexSections,
 * calculateIndexSize, getClaudeMdPath, claudeMdExists, readClaudeMd.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { createIndexSection } from "../../helpers/factories.js";
import { createMockFs } from "../../helpers/mock-fs.js";

// ---------------------------------------------------------------------------
// Filesystem mocks -- must be set up BEFORE importing index-parser.ts
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

// Dynamic import of the module under test (after mocks are registered)
const {
  parseIndex,
  generateIndex,
  generateIndexBlock,
  extractIndexFromClaudeMd,
  updateClaudeMdIndex,
  buildIndexSections,
  calculateIndexSize,
  getClaudeMdPath,
  claudeMdExists,
  readClaudeMd,
} = await import("../../../src/lib/index-parser.js");

const { PDI_BEGIN_MARKER, PDI_END_MARKER } = await import(
  "../../../src/lib/constants.js"
);

// Fixture loaders
const withIndexFixture = await Bun.file(
  join(import.meta.dir, "../../fixtures/claude-md/with-index.md")
).text();
const withoutIndexFixture = await Bun.file(
  join(import.meta.dir, "../../fixtures/claude-md/without-index.md")
).text();

// ---------------------------------------------------------------------------
// Reset mock state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  files.clear();
});

// ============================================================================
// parseIndex
// ============================================================================

describe("parseIndex", () => {
  test("parses section header: extracts title and root", () => {
    const input = "[Framework Docs]|root:.claude-docs/frameworks";
    const sections = parseIndex(input);
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("Framework Docs");
    expect(sections[0].root).toBe(".claude-docs/frameworks");
  });

  test("parses critical instructions", () => {
    const input = `[Framework Docs]|root:.claude-docs/frameworks
|CRITICAL:Read docs before coding`;
    const sections = parseIndex(input);
    expect(sections[0].criticalInstructions).toEqual([
      "Read docs before coding",
    ]);
  });

  test("parses entry: extracts package, version, categories with files", () => {
    const input = `[Framework Docs]|root:.claude-docs/frameworks
|hono@4.x|api:{app.mdx,routing.mdx}|patterns:{error-handling.mdx}`;
    const sections = parseIndex(input);
    expect(sections[0].entries.length).toBe(1);
    const entry = sections[0].entries[0];
    expect(entry.package).toBe("hono");
    expect(entry.version).toBe("4.x");
    expect(entry.categories.length).toBe(2);
    expect(entry.categories[0].name).toBe("api");
    expect(entry.categories[0].files).toEqual(["app.mdx", "routing.mdx"]);
    expect(entry.categories[1].name).toBe("patterns");
    expect(entry.categories[1].files).toEqual(["error-handling.mdx"]);
  });

  test("parses multiple sections", () => {
    const input = `[Framework Docs]|root:.claude-docs/frameworks
|hono@4.x|api:{app.mdx}
[Internal Patterns]|root:.claude-docs/internal
|database@|database:{two-schema-pattern.mdx}`;
    const sections = parseIndex(input);
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe("Framework Docs");
    expect(sections[1].title).toBe("Internal Patterns");
  });

  test("handles empty input", () => {
    const sections = parseIndex("");
    expect(sections).toEqual([]);
  });

  test("ignores malformed lines", () => {
    const input = `[Framework Docs]|root:.claude-docs/frameworks
this is not a valid line
another bad line
|hono@4.x|api:{app.mdx}`;
    const sections = parseIndex(input);
    expect(sections.length).toBe(1);
    expect(sections[0].entries.length).toBe(1);
  });

  test("parses multiple critical instructions", () => {
    const input = `[Framework Docs]|root:.claude-docs/frameworks
|CRITICAL:First instruction
|CRITICAL:Second instruction`;
    const sections = parseIndex(input);
    expect(sections[0].criticalInstructions.length).toBe(2);
    expect(sections[0].criticalInstructions[0]).toBe("First instruction");
    expect(sections[0].criticalInstructions[1]).toBe("Second instruction");
  });

  test("ignores lines before first section header", () => {
    const input = `|hono@4.x|api:{app.mdx}
[Framework Docs]|root:.claude-docs/frameworks
|drizzle@0.44|schema:{tables.mdx}`;
    const sections = parseIndex(input);
    expect(sections.length).toBe(1);
    // The hono line should be ignored since it was before a section header
    expect(sections[0].entries.length).toBe(1);
    expect(sections[0].entries[0].package).toBe("drizzle");
  });
});

// ============================================================================
// generateIndex
// ============================================================================

describe("generateIndex", () => {
  test("round-trips with parseIndex", () => {
    const original = `[Framework Docs]|root:.claude-docs/frameworks
|CRITICAL:Prefer retrieval-led reasoning over pre-training-led reasoning
|hono@4.x|api:{app.mdx,routing.mdx}|patterns:{error-handling.mdx}`;
    const sections = parseIndex(original);
    const regenerated = generateIndex(sections);
    expect(regenerated).toBe(original);
  });

  test("generates correct format for single section with one entry", () => {
    const sections = [
      createIndexSection({
        title: "Test Section",
        root: ".test/path",
        criticalInstructions: ["Do the thing"],
        entries: [
          {
            package: "hono",
            version: "4.x",
            categories: [{ name: "api", files: ["app.mdx"] }],
          },
        ],
      }),
    ];
    const output = generateIndex(sections);
    expect(output).toBe(
      "[Test Section]|root:.test/path\n|CRITICAL:Do the thing\n|hono@4.x|api:{app.mdx}"
    );
  });

  test("generates correct format for multiple sections", () => {
    const sections = [
      createIndexSection({
        title: "Section A",
        root: ".docs/a",
        criticalInstructions: [],
        entries: [
          {
            package: "pkg-a",
            version: "1.0",
            categories: [{ name: "cat", files: ["file.mdx"] }],
          },
        ],
      }),
      createIndexSection({
        title: "Section B",
        root: ".docs/b",
        criticalInstructions: [],
        entries: [
          {
            package: "pkg-b",
            version: "2.0",
            categories: [{ name: "cat2", files: ["file2.mdx"] }],
          },
        ],
      }),
    ];
    const output = generateIndex(sections);
    expect(output).toContain("[Section A]|root:.docs/a");
    expect(output).toContain("[Section B]|root:.docs/b");
    expect(output).toContain("|pkg-a@1.0|cat:{file.mdx}");
    expect(output).toContain("|pkg-b@2.0|cat2:{file2.mdx}");
  });
});

// ============================================================================
// generateIndexBlock
// ============================================================================

describe("generateIndexBlock", () => {
  test("includes PDI_BEGIN_MARKER and PDI_END_MARKER", () => {
    const sections = [
      createIndexSection({
        entries: [
          {
            package: "hono",
            version: "4.x",
            categories: [{ name: "api", files: ["app.mdx"] }],
          },
        ],
      }),
    ];
    const block = generateIndexBlock(sections);
    expect(block).toContain(PDI_BEGIN_MARKER);
    expect(block).toContain(PDI_END_MARKER);
  });

  test("includes MCP fallback comment when libraryMappings provided", () => {
    const sections = [createIndexSection()];
    const mappings = {
      hono: "/honojs/hono",
      drizzle: "/drizzle-team/drizzle-orm",
    };
    const block = generateIndexBlock(sections, mappings);
    expect(block).toContain("<!-- MCP Fallback: Context7 for expanded queries");
    expect(block).toContain("hono=/honojs/hono");
    expect(block).toContain("drizzle=/drizzle-team/drizzle-orm");
  });

  test("omits MCP fallback comment when no mappings", () => {
    const sections = [createIndexSection()];
    const block = generateIndexBlock(sections);
    expect(block).not.toContain("MCP Fallback");
  });

  test("omits MCP fallback comment when mappings is empty object", () => {
    const sections = [createIndexSection()];
    const block = generateIndexBlock(sections, {});
    expect(block).not.toContain("MCP Fallback");
  });
});

// ============================================================================
// extractIndexFromClaudeMd
// ============================================================================

describe("extractIndexFromClaudeMd", () => {
  test("extracts content between pdi:begin and pdi:end markers", () => {
    const extracted = extractIndexFromClaudeMd(withIndexFixture);
    expect(extracted).not.toBeNull();
    expect(extracted).toContain(
      "[Framework Docs]|root:.claude-docs/frameworks"
    );
    expect(extracted).toContain("|hono@4.x|");
    expect(extracted).toContain("|drizzle@0.44|");
  });

  test("returns null when no markers present", () => {
    const extracted = extractIndexFromClaudeMd(withoutIndexFixture);
    expect(extracted).toBeNull();
  });

  test("returns null when markers are in wrong order", () => {
    const content = `${PDI_END_MARKER}\nsome content\n${PDI_BEGIN_MARKER}`;
    const extracted = extractIndexFromClaudeMd(content);
    expect(extracted).toBeNull();
  });

  test("returns null when only begin marker present", () => {
    const content = `${PDI_BEGIN_MARKER}\nsome content`;
    const extracted = extractIndexFromClaudeMd(content);
    expect(extracted).toBeNull();
  });

  test("returns null when only end marker present", () => {
    const content = `some content\n${PDI_END_MARKER}`;
    const extracted = extractIndexFromClaudeMd(content);
    expect(extracted).toBeNull();
  });
});

// ============================================================================
// updateClaudeMdIndex
// ============================================================================

describe("updateClaudeMdIndex", () => {
  const testSections = [
    createIndexSection({
      entries: [
        {
          package: "hono",
          version: "4.x",
          categories: [{ name: "api", files: ["app.mdx"] }],
        },
      ],
    }),
  ];

  test("creates new CLAUDE.md when file doesn't exist", async () => {
    const result = await updateClaudeMdIndex("/project", testSections);
    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);

    const claudePath = join("/project", "CLAUDE.md");
    expect(files.has(claudePath)).toBe(true);
    const content = files.get(claudePath)!;
    expect(content).toContain(PDI_BEGIN_MARKER);
    expect(content).toContain(PDI_END_MARKER);
    expect(content).toContain("# CLAUDE.md");
  });

  test("updates existing index when markers present", async () => {
    const claudePath = join("/project", "CLAUDE.md");
    files.set(claudePath, withIndexFixture);

    const result = await updateClaudeMdIndex("/project", testSections);
    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);

    const content = files.get(claudePath)!;
    // Should contain new content
    expect(content).toContain("|hono@4.x|api:{app.mdx}");
    // Should preserve content before markers
    expect(content).toContain("This is a fullstack application");
  });

  test("appends index when CLAUDE.md exists but has no markers", async () => {
    const claudePath = join("/project", "CLAUDE.md");
    files.set(claudePath, withoutIndexFixture);

    const result = await updateClaudeMdIndex("/project", testSections);
    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);

    const content = files.get(claudePath)!;
    // Should preserve original content
    expect(content).toContain("A sample project without PDI configured");
    // Should append the index
    expect(content).toContain(PDI_BEGIN_MARKER);
    expect(content).toContain(PDI_END_MARKER);
  });

  test("preserves content before and after markers", async () => {
    const claudePath = join("/project", "CLAUDE.md");
    const existingContent = `# My Project

Before markers content here.

${PDI_BEGIN_MARKER}
[Old Section]|root:.old
${PDI_END_MARKER}

After markers content here.
`;
    files.set(claudePath, existingContent);

    await updateClaudeMdIndex("/project", testSections);
    const content = files.get(claudePath)!;
    expect(content).toContain("Before markers content here.");
    expect(content).toContain("After markers content here.");
    expect(content).not.toContain("[Old Section]|root:.old");
  });

  test("includes MCP fallback when libraryMappings provided", async () => {
    const claudePath = join("/project", "CLAUDE.md");
    files.set(claudePath, withoutIndexFixture);

    await updateClaudeMdIndex("/project", testSections, {
      hono: "/honojs/hono",
    });
    const content = files.get(claudePath)!;
    expect(content).toContain("MCP Fallback");
    expect(content).toContain("hono=/honojs/hono");
  });
});

// ============================================================================
// buildIndexSections
// ============================================================================

describe("buildIndexSections", () => {
  test("builds framework section from framework data", () => {
    const frameworks = {
      hono: {
        version: "4.x",
        categories: {
          api: ["app.mdx", "routing.mdx"],
          patterns: ["error-handling.mdx"],
        },
      },
    };
    const sections = buildIndexSections(
      ".claude-docs/frameworks",
      ".claude-docs/internal",
      frameworks,
      {}
    );
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("Framework Docs");
    expect(sections[0].root).toBe(".claude-docs/frameworks");
    expect(sections[0].entries.length).toBe(1);
    expect(sections[0].entries[0].package).toBe("hono");
    expect(sections[0].entries[0].version).toBe("4.x");
  });

  test("builds internal section from internal data", () => {
    const internal = {
      database: ["two-schema-pattern.mdx"],
      conventions: ["esm-imports.mdx"],
    };
    const sections = buildIndexSections(
      ".claude-docs/frameworks",
      ".claude-docs/internal",
      {},
      internal
    );
    expect(sections.length).toBe(1);
    expect(sections[0].title).toBe("Internal Patterns");
    expect(sections[0].root).toBe(".claude-docs/internal");
  });

  test("returns empty array when no data", () => {
    const sections = buildIndexSections(
      ".claude-docs/frameworks",
      ".claude-docs/internal",
      {},
      {}
    );
    expect(sections).toEqual([]);
  });

  test("builds both sections when frameworks and internal data provided", () => {
    const frameworks = {
      hono: {
        version: "4.x",
        categories: { api: ["app.mdx"] },
      },
    };
    const internal = {
      conventions: ["esm.mdx"],
    };
    const sections = buildIndexSections(
      ".claude-docs/frameworks",
      ".claude-docs/internal",
      frameworks,
      internal
    );
    expect(sections.length).toBe(2);
    expect(sections[0].title).toBe("Framework Docs");
    expect(sections[1].title).toBe("Internal Patterns");
  });

  test("uses custom critical instructions when provided", () => {
    const frameworks = {
      hono: {
        version: "4.x",
        categories: { api: ["app.mdx"] },
      },
    };
    const sections = buildIndexSections(
      ".claude-docs/frameworks",
      ".claude-docs/internal",
      frameworks,
      {},
      { frameworkCriticals: ["Custom critical instruction"] }
    );
    expect(sections[0].criticalInstructions).toEqual([
      "Custom critical instruction",
    ]);
  });

  test("uses default critical instructions when not provided", () => {
    const frameworks = {
      hono: {
        version: "4.x",
        categories: { api: ["app.mdx"] },
      },
    };
    const sections = buildIndexSections(
      ".claude-docs/frameworks",
      ".claude-docs/internal",
      frameworks,
      {}
    );
    expect(sections[0].criticalInstructions.length).toBe(2);
    expect(sections[0].criticalInstructions[0]).toContain("retrieval-led");
  });
});

// ============================================================================
// calculateIndexSize
// ============================================================================

describe("calculateIndexSize", () => {
  test("returns size in KB", () => {
    const sections = [
      createIndexSection({
        entries: [
          {
            package: "hono",
            version: "4.x",
            categories: [{ name: "api", files: ["app.mdx", "routing.mdx"] }],
          },
        ],
      }),
    ];
    const sizeKb = calculateIndexSize(sections);
    expect(sizeKb).toBeGreaterThan(0);
    expect(typeof sizeKb).toBe("number");
  });

  test("returns 0 for empty sections", () => {
    // Even empty sections produce markers, so it won't be exactly 0
    // But it should be a small number
    const sizeKb = calculateIndexSize([]);
    expect(sizeKb).toBeGreaterThan(0); // Markers still contribute
  });
});

// ============================================================================
// getClaudeMdPath
// ============================================================================

describe("getClaudeMdPath", () => {
  test("returns correct path joining projectRoot + CLAUDE.md", () => {
    const result = getClaudeMdPath("/my/project");
    expect(result).toBe(join("/my/project", "CLAUDE.md"));
  });
});

// ============================================================================
// claudeMdExists
// ============================================================================

describe("claudeMdExists", () => {
  test("returns true when CLAUDE.md exists", async () => {
    const claudePath = join("/project", "CLAUDE.md");
    files.set(claudePath, "# CLAUDE.md");
    const result = await claudeMdExists("/project");
    expect(result).toBe(true);
  });

  test("returns false when CLAUDE.md does not exist", async () => {
    const result = await claudeMdExists("/project");
    expect(result).toBe(false);
  });
});

// ============================================================================
// readClaudeMd
// ============================================================================

describe("readClaudeMd", () => {
  test("returns content when file exists", async () => {
    const claudePath = join("/project", "CLAUDE.md");
    files.set(claudePath, withIndexFixture);
    const result = await readClaudeMd("/project");
    expect(result).toBe(withIndexFixture);
  });

  test("returns null when file does not exist", async () => {
    const result = await readClaudeMd("/project");
    expect(result).toBeNull();
  });
});
