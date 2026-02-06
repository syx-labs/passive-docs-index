/**
 * Unit tests for src/lib/fs-utils.ts
 *
 * Tests all exported functions: ensureDir, removeDir, listDir, listDirRecursive,
 * writeDocFile, writeInternalDocFile, readDocFile, readFrameworkDocs,
 * readAllFrameworkDocs, readInternalDocs, calculateDocsSize, formatSize,
 * updateGitignore.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";
import { createMockFs } from "../../helpers/mock-fs.js";

// ---------------------------------------------------------------------------
// Filesystem mocks -- must be set up BEFORE importing fs-utils.ts
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

// Dynamic import of the module under test (after mocks are registered)
const {
  ensureDir,
  removeDir,
  listDir,
  listDirRecursive,
  writeDocFile,
  writeInternalDocFile,
  readDocFile,
  readFrameworkDocs,
  readAllFrameworkDocs,
  readInternalDocs,
  calculateDocsSize,
  formatSize,
  updateGitignore,
} = await import("../../../src/lib/fs-utils.js");

// ---------------------------------------------------------------------------
// Reset mock state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  files.clear();
  // Reset mock call counters
  fsMock.existsSync.mockClear();
  fsPromisesMock.mkdir.mockClear();
  fsPromisesMock.rm.mockClear();
  fsPromisesMock.readdir.mockClear();
  fsPromisesMock.readFile.mockClear();
  fsPromisesMock.writeFile.mockClear();
  fsPromisesMock.stat.mockClear();
});

// ============================================================================
// ensureDir
// ============================================================================

describe("ensureDir", () => {
  test("creates directory when it doesn't exist", async () => {
    await ensureDir("/project/new-dir");
    expect(fsPromisesMock.mkdir).toHaveBeenCalledWith("/project/new-dir", {
      recursive: true,
    });
  });

  test("does nothing when directory exists", async () => {
    // Simulate directory exists by placing a file under it
    files.set("/project/existing-dir/file.txt", "content");
    await ensureDir("/project/existing-dir");
    expect(fsPromisesMock.mkdir).not.toHaveBeenCalled();
  });
});

// ============================================================================
// removeDir
// ============================================================================

describe("removeDir", () => {
  test("removes directory when it exists", async () => {
    files.set("/project/dir/file.txt", "content");
    await removeDir("/project/dir");
    expect(fsPromisesMock.rm).toHaveBeenCalled();
    // Files under the directory should be removed
    expect(files.has("/project/dir/file.txt")).toBe(false);
  });

  test("does nothing when directory doesn't exist", async () => {
    await removeDir("/project/nonexistent");
    expect(fsPromisesMock.rm).not.toHaveBeenCalled();
  });
});

// ============================================================================
// listDir
// ============================================================================

describe("listDir", () => {
  test("returns file list when directory exists", async () => {
    files.set("/project/dir/a.txt", "aaa");
    files.set("/project/dir/b.txt", "bbb");
    const result = await listDir("/project/dir");
    expect(result.sort()).toEqual(["a.txt", "b.txt"]);
  });

  test("returns empty array when directory doesn't exist", async () => {
    const result = await listDir("/project/nonexistent");
    expect(result).toEqual([]);
  });
});

// ============================================================================
// listDirRecursive
// ============================================================================

describe("listDirRecursive", () => {
  test("returns all files recursively", async () => {
    files.set("/project/dir/a.txt", "aaa");
    files.set("/project/dir/sub/b.txt", "bbb");
    files.set("/project/dir/sub/deep/c.txt", "ccc");
    const result = await listDirRecursive("/project/dir");
    expect(result.sort()).toEqual([
      "/project/dir/a.txt",
      "/project/dir/sub/b.txt",
      "/project/dir/sub/deep/c.txt",
    ]);
  });

  test("returns empty array when directory doesn't exist", async () => {
    const result = await listDirRecursive("/project/nonexistent");
    expect(result).toEqual([]);
  });
});

// ============================================================================
// writeDocFile
// ============================================================================

describe("writeDocFile", () => {
  test("creates correct file path from framework/category/filename", async () => {
    const result = await writeDocFile(
      "/project",
      "hono",
      "api",
      "routing.mdx",
      "# Routing"
    );
    expect(result).toBe(
      join(
        "/project",
        ".claude-docs",
        "frameworks",
        "hono",
        "api",
        "routing.mdx"
      )
    );
  });

  test("writes content to the file", async () => {
    await writeDocFile("/project", "hono", "api", "routing.mdx", "# Routing");
    const filePath = join(
      "/project",
      ".claude-docs",
      "frameworks",
      "hono",
      "api",
      "routing.mdx"
    );
    expect(files.get(filePath)).toBe("# Routing");
  });

  test("ensures parent directory exists", async () => {
    await writeDocFile("/project", "hono", "api", "routing.mdx", "# Routing");
    // mkdir should be called for the directory since it doesn't exist
    expect(fsPromisesMock.mkdir).toHaveBeenCalled();
  });
});

// ============================================================================
// writeInternalDocFile
// ============================================================================

describe("writeInternalDocFile", () => {
  test("creates correct file path under internal directory", async () => {
    const result = await writeInternalDocFile(
      "/project",
      "conventions",
      "esm.mdx",
      "# ESM"
    );
    expect(result).toBe(
      join("/project", ".claude-docs", "internal", "conventions", "esm.mdx")
    );
  });
});

// ============================================================================
// readDocFile
// ============================================================================

describe("readDocFile", () => {
  test("returns content when file exists", async () => {
    files.set("/project/doc.mdx", "# My Doc\n\nContent here.");
    const result = await readDocFile("/project/doc.mdx");
    expect(result).toBe("# My Doc\n\nContent here.");
  });

  test("returns null when file doesn't exist", async () => {
    const result = await readDocFile("/project/nonexistent.mdx");
    expect(result).toBeNull();
  });
});

// ============================================================================
// readFrameworkDocs
// ============================================================================

describe("readFrameworkDocs", () => {
  test("returns categorized docs structure", async () => {
    const base = "/project/.claude-docs/frameworks/hono";
    files.set(`${base}/api/app.mdx`, "# App");
    files.set(`${base}/api/routing.mdx`, "# Routing");
    files.set(`${base}/patterns/error-handling.mdx`, "# Errors");

    const result = await readFrameworkDocs("/project", "hono");
    expect(result.api).toBeDefined();
    expect(result.api.length).toBe(2);
    expect(result.patterns).toBeDefined();
    expect(result.patterns.length).toBe(1);
  });

  test("only includes .mdx files", async () => {
    const base = "/project/.claude-docs/frameworks/hono";
    files.set(`${base}/api/app.mdx`, "# App");
    files.set(`${base}/api/readme.txt`, "Not an mdx");

    const result = await readFrameworkDocs("/project", "hono");
    expect(result.api.length).toBe(1);
    expect(result.api[0].name).toBe("app.mdx");
  });

  test("returns empty object for missing framework", async () => {
    const result = await readFrameworkDocs("/project", "nonexistent");
    expect(result).toEqual({});
  });

  test("doc files have correct metadata", async () => {
    const base = "/project/.claude-docs/frameworks/hono";
    files.set(`${base}/api/app.mdx`, "# Hono App");

    const result = await readFrameworkDocs("/project", "hono");
    const doc = result.api[0];
    expect(doc.framework).toBe("hono");
    expect(doc.category).toBe("api");
    expect(doc.name).toBe("app.mdx");
    expect(doc.content).toBe("# Hono App");
    expect(doc.sizeBytes).toBeGreaterThan(0);
  });
});

// ============================================================================
// readAllFrameworkDocs
// ============================================================================

describe("readAllFrameworkDocs", () => {
  test("returns docs for all frameworks", async () => {
    files.set(
      "/project/.claude-docs/frameworks/hono/api/app.mdx",
      "# Hono App"
    );
    files.set(
      "/project/.claude-docs/frameworks/drizzle/schema/tables.mdx",
      "# Tables"
    );

    const result = await readAllFrameworkDocs("/project");
    expect(result.hono).toBeDefined();
    expect(result.drizzle).toBeDefined();
  });

  test("returns empty object when frameworks directory doesn't exist", async () => {
    const result = await readAllFrameworkDocs("/project");
    expect(result).toEqual({});
  });
});

// ============================================================================
// readInternalDocs
// ============================================================================

describe("readInternalDocs", () => {
  test("returns categorized internal docs", async () => {
    files.set("/project/.claude-docs/internal/conventions/esm.mdx", "# ESM");
    files.set(
      "/project/.claude-docs/internal/database/two-schema.mdx",
      "# Two Schema"
    );

    const result = await readInternalDocs("/project");
    expect(result.conventions).toBeDefined();
    expect(result.database).toBeDefined();
  });

  test("returns empty object when internal directory doesn't exist", async () => {
    const result = await readInternalDocs("/project");
    expect(result).toEqual({});
  });
});

// ============================================================================
// calculateDocsSize
// ============================================================================

describe("calculateDocsSize", () => {
  test("returns framework sizes and total", async () => {
    files.set(
      "/project/.claude-docs/frameworks/hono/api/app.mdx",
      "A".repeat(100)
    );
    files.set(
      "/project/.claude-docs/frameworks/drizzle/schema/tables.mdx",
      "B".repeat(200)
    );

    const result = await calculateDocsSize("/project");
    expect(result.frameworks.hono).toBe(100);
    expect(result.frameworks.drizzle).toBe(200);
    expect(result.total).toBe(300);
  });

  test("only counts .mdx files", async () => {
    files.set(
      "/project/.claude-docs/frameworks/hono/api/app.mdx",
      "A".repeat(100)
    );
    files.set(
      "/project/.claude-docs/frameworks/hono/api/readme.txt",
      "B".repeat(200)
    );

    const result = await calculateDocsSize("/project");
    expect(result.frameworks.hono).toBe(100);
    expect(result.total).toBe(100);
  });

  test("returns zeros when docs path doesn't exist", async () => {
    const result = await calculateDocsSize("/project");
    expect(result.frameworks).toEqual({});
    expect(result.internal).toBe(0);
    expect(result.total).toBe(0);
  });

  test("counts internal docs separately", async () => {
    files.set(
      "/project/.claude-docs/internal/conventions/esm.mdx",
      "C".repeat(50)
    );
    files.set(
      "/project/.claude-docs/frameworks/hono/api/app.mdx",
      "D".repeat(75)
    );

    const result = await calculateDocsSize("/project");
    expect(result.internal).toBe(50);
    expect(result.frameworks.hono).toBe(75);
    expect(result.total).toBe(125);
  });
});

// ============================================================================
// formatSize
// ============================================================================

describe("formatSize", () => {
  test('"500" -> "500B"', () => {
    expect(formatSize(500)).toBe("500B");
  });

  test('"1024" -> "1.0KB"', () => {
    expect(formatSize(1024)).toBe("1.0KB");
  });

  test('"1536" -> "1.5KB"', () => {
    expect(formatSize(1536)).toBe("1.5KB");
  });

  test('"1048576" -> "1.00MB"', () => {
    expect(formatSize(1_048_576)).toBe("1.00MB");
  });

  test('"0" -> "0B"', () => {
    expect(formatSize(0)).toBe("0B");
  });

  test('"1023" -> "1023B"', () => {
    expect(formatSize(1023)).toBe("1023B");
  });
});

// ============================================================================
// updateGitignore
// ============================================================================

describe("updateGitignore", () => {
  test("creates .gitignore with cache entry when file doesn't exist", async () => {
    const result = await updateGitignore("/project");
    expect(result).toBe(true);

    const gitignorePath = join("/project", ".gitignore");
    const content = files.get(gitignorePath)!;
    expect(content).toContain(".claude-docs/.cache/");
  });

  test("appends cache entry when file exists but doesn't have it", async () => {
    const gitignorePath = join("/project", ".gitignore");
    files.set(gitignorePath, "node_modules/\ndist/\n");

    const result = await updateGitignore("/project");
    expect(result).toBe(true);

    const content = files.get(gitignorePath)!;
    expect(content).toContain("node_modules/");
    expect(content).toContain(".claude-docs/.cache/");
  });

  test("does nothing when entry already present (returns false)", async () => {
    const gitignorePath = join("/project", ".gitignore");
    files.set(gitignorePath, "node_modules/\n.claude-docs/.cache/\n");

    const result = await updateGitignore("/project");
    expect(result).toBe(false);
  });
});
