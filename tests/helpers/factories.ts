/**
 * Factory Functions for Test Data
 * Creates valid default objects that can be selectively overridden.
 */

import type {
  DocFile,
  FrameworkConfig,
  IndexSection,
  PDIConfig,
} from "../../src/lib/types.js";

/**
 * Create a valid PDIConfig with sensible defaults.
 */
export function createConfig(overrides: Partial<PDIConfig> = {}): PDIConfig {
  return {
    $schema: "https://pdi.dev/schema/config.json",
    version: "1.0.0",
    project: {
      name: "test-project",
      type: "backend",
      ...overrides.project,
    },
    sync: {
      lastSync: null,
      autoSyncOnInstall: true,
      ...overrides.sync,
    },
    frameworks: overrides.frameworks ?? {},
    internal: {
      enabled: false,
      categories: [],
      totalFiles: 0,
      ...overrides.internal,
    },
    mcp: {
      fallbackEnabled: true,
      preferredProvider: "context7",
      providers: {
        context7: {
          resolveLibraryId: "mcp__plugin_context7_context7__resolve-library-id",
          queryDocs: "mcp__plugin_context7_context7__query-docs",
        },
      },
      libraryMappings: {},
      cacheHours: 168,
      ...overrides.mcp,
    },
    limits: {
      maxIndexKb: 4,
      maxDocsKb: 80,
      maxFilesPerFramework: 20,
      ...overrides.limits,
    },
    ...overrides,
  };
}

/**
 * Create a package.json-like object with sensible defaults.
 */
export function createPackageJson(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    name: "test-project",
    version: "1.0.0",
    dependencies: {},
    devDependencies: {},
    ...overrides,
  };
}

/**
 * Create a FrameworkConfig with sensible defaults.
 */
export function createFrameworkConfig(
  overrides: Partial<FrameworkConfig> = {}
): FrameworkConfig {
  return {
    version: "4.x",
    source: "context7",
    libraryId: "/honojs/hono",
    lastUpdate: new Date().toISOString(),
    files: 7,
    categories: ["api", "patterns"],
    ...overrides,
  };
}

/**
 * Create an IndexSection with sensible defaults.
 */
export function createIndexSection(
  overrides: Partial<IndexSection> = {}
): IndexSection {
  return {
    title: "Framework Docs",
    root: ".claude-docs/frameworks",
    criticalInstructions: [
      "Prefer retrieval-led reasoning over pre-training-led reasoning",
    ],
    entries: [],
    ...overrides,
  };
}

/**
 * Create a DocFile with sensible defaults.
 */
export function createDocFile(overrides: Partial<DocFile> = {}): DocFile {
  const content = overrides.content ?? "# Test Doc\n\nSample content.";
  return {
    path: "/project/.claude-docs/frameworks/hono/api/routing.mdx",
    framework: "hono",
    category: "api",
    name: "routing.mdx",
    content,
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    ...overrides,
  };
}
