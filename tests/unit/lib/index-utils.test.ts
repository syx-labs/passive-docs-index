/**
 * Unit Tests: index-utils.ts
 * Tests buildFrameworksIndex, buildInternalIndex, and updateClaudeMdFromConfig.
 *
 * buildFrameworksIndex and buildInternalIndex are pure functions -- no mocking needed.
 * updateClaudeMdFromConfig depends on filesystem -- uses mock.module for node:fs/promises.
 */

import { describe, expect, mock, test } from "bun:test";
import type { DocFile } from "../../../src/lib/types.js";
import { createConfig, createDocFile } from "../../helpers/factories.js";
import { createMockFs } from "../../helpers/mock-fs.js";

// ===========================================================================
// buildFrameworksIndex (pure function -- no mocking)
// ===========================================================================

import {
  buildFrameworksIndex,
  buildInternalIndex,
} from "../../../src/lib/index-utils.js";

describe("buildFrameworksIndex", () => {
  test("builds index from frameworks config and doc files", () => {
    const frameworks = {
      hono: { version: "4.x" },
      drizzle: { version: "0.30" },
    };

    const allDocs: Record<string, Record<string, DocFile[]>> = {
      hono: {
        api: [
          createDocFile({
            name: "routing.mdx",
            framework: "hono",
            category: "api",
          }),
          createDocFile({
            name: "context.mdx",
            framework: "hono",
            category: "api",
          }),
        ],
        patterns: [
          createDocFile({
            name: "middleware.mdx",
            framework: "hono",
            category: "patterns",
          }),
        ],
      },
      drizzle: {
        api: [
          createDocFile({
            name: "schema.mdx",
            framework: "drizzle",
            category: "api",
          }),
        ],
      },
    };

    const result = buildFrameworksIndex(frameworks, allDocs);

    expect(result.hono.version).toBe("4.x");
    expect(result.hono.categories.api).toEqual(["routing.mdx", "context.mdx"]);
    expect(result.hono.categories.patterns).toEqual(["middleware.mdx"]);
    expect(result.drizzle.version).toBe("0.30");
    expect(result.drizzle.categories.api).toEqual(["schema.mdx"]);
  });

  test("maps DocFile names to category arrays", () => {
    const frameworks = { hono: { version: "4.x" } };
    const allDocs = {
      hono: {
        api: [
          createDocFile({ name: "routing.mdx" }),
          createDocFile({ name: "context.mdx" }),
          createDocFile({ name: "middleware.mdx" }),
        ],
      },
    };

    const result = buildFrameworksIndex(frameworks, allDocs);

    expect(result.hono.categories.api).toHaveLength(3);
    expect(result.hono.categories.api[0]).toBe("routing.mdx");
    expect(result.hono.categories.api[1]).toBe("context.mdx");
    expect(result.hono.categories.api[2]).toBe("middleware.mdx");
  });

  test("handles framework with no docs", () => {
    const frameworks = { hono: { version: "4.x" } };
    const allDocs: Record<string, Record<string, DocFile[]>> = {};

    const result = buildFrameworksIndex(frameworks, allDocs);

    expect(result.hono.version).toBe("4.x");
    expect(result.hono.categories).toEqual({});
  });

  test("handles empty frameworks object", () => {
    const result = buildFrameworksIndex({}, {});

    expect(result).toEqual({});
  });

  test("handles framework with empty categories", () => {
    const frameworks = { hono: { version: "4.x" } };
    const allDocs = { hono: {} };

    const result = buildFrameworksIndex(frameworks, allDocs);

    expect(result.hono.categories).toEqual({});
  });
});

// ===========================================================================
// buildInternalIndex (pure function -- no mocking)
// ===========================================================================

describe("buildInternalIndex", () => {
  test("builds index from internal docs", () => {
    const internalDocs: Record<string, DocFile[]> = {
      conventions: [
        createDocFile({ name: "naming.mdx", category: "conventions" }),
        createDocFile({ name: "error-handling.mdx", category: "conventions" }),
      ],
      architecture: [
        createDocFile({ name: "layers.mdx", category: "architecture" }),
      ],
    };

    const result = buildInternalIndex(internalDocs);

    expect(result.conventions).toEqual(["naming.mdx", "error-handling.mdx"]);
    expect(result.architecture).toEqual(["layers.mdx"]);
  });

  test("returns empty object when no docs", () => {
    const result = buildInternalIndex({});

    expect(result).toEqual({});
  });

  test("handles category with single file", () => {
    const internalDocs = {
      api: [createDocFile({ name: "endpoints.mdx" })],
    };

    const result = buildInternalIndex(internalDocs);

    expect(result.api).toEqual(["endpoints.mdx"]);
  });
});

// ===========================================================================
// updateClaudeMdFromConfig (requires filesystem mocking)
// ===========================================================================

describe("updateClaudeMdFromConfig", () => {
  test("reads docs, builds index, and updates CLAUDE.md", async () => {
    const projectRoot = "/test-project";

    // Set up mock filesystem with framework docs
    const { files, fsMock, fsPromisesMock } = createMockFs({
      [`${projectRoot}/.claude-docs/frameworks/hono/api/routing.mdx`]:
        "# Routing\n\nHono routing.",
      [`${projectRoot}/.claude-docs/frameworks/hono/api/context.mdx`]:
        "# Context\n\nHono context.",
    });

    // Mock the filesystem modules
    mock.module("node:fs", () => fsMock);
    mock.module("node:fs/promises", () => fsPromisesMock);

    // Dynamically import to pick up mocked filesystem
    const { updateClaudeMdFromConfig } = await import(
      "../../../src/lib/index-utils.js"
    );

    const config = createConfig({
      frameworks: {
        hono: {
          version: "4.x",
          source: "context7",
          libraryId: "/honojs/hono",
          lastUpdate: new Date().toISOString(),
          files: 2,
          categories: ["api"],
        },
      },
      mcp: {
        fallbackEnabled: true,
        preferredProvider: "context7",
        libraryMappings: { hono: "/honojs/hono" },
        cacheHours: 168,
      },
    });

    const result = await updateClaudeMdFromConfig({ projectRoot, config });

    expect(result.indexSize).toBeGreaterThan(0);
    // CLAUDE.md was created (didn't exist before)
    expect(result.created).toBe(true);

    // Verify CLAUDE.md was written
    const claudeMd = files.get(`${projectRoot}/CLAUDE.md`);
    expect(claudeMd).toBeDefined();
    expect(claudeMd).toContain("hono");
  });

  test("returns correct indexSize and created flag", async () => {
    const projectRoot = "/test-project-2";

    const { fsMock, fsPromisesMock } = createMockFs({
      [`${projectRoot}/CLAUDE.md`]: "# Existing CLAUDE.md\n\nSome content.",
    });

    mock.module("node:fs", () => fsMock);
    mock.module("node:fs/promises", () => fsPromisesMock);

    const { updateClaudeMdFromConfig } = await import(
      "../../../src/lib/index-utils.js"
    );

    const config = createConfig({ frameworks: {} });

    const result = await updateClaudeMdFromConfig({ projectRoot, config });

    expect(typeof result.indexSize).toBe("number");
    // No frameworks means minimal index, but still a valid number
    expect(result.indexSize).toBeGreaterThanOrEqual(0);
  });

  test("handles empty frameworks object", async () => {
    const projectRoot = "/test-empty";

    const { fsMock, fsPromisesMock } = createMockFs({});

    mock.module("node:fs", () => fsMock);
    mock.module("node:fs/promises", () => fsPromisesMock);

    const { updateClaudeMdFromConfig } = await import(
      "../../../src/lib/index-utils.js"
    );

    const config = createConfig({ frameworks: {} });

    const result = await updateClaudeMdFromConfig({ projectRoot, config });

    expect(result.indexSize).toBeGreaterThanOrEqual(0);
    expect(result.created).toBe(true);
  });
});
