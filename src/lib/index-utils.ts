/**
 * Index Utilities
 * Shared functions for building and updating CLAUDE.md index across commands
 */

import { FRAMEWORKS_DIR, INTERNAL_DIR } from "./constants.js";
import { readAllFrameworkDocs, readInternalDocs } from "./fs-utils.js";
import {
  buildIndexSections,
  calculateIndexSize,
  updateClaudeMdIndex,
} from "./index-parser.js";
import type { DocFile, PDIConfig } from "./types.js";

export interface UpdateIndexOptions {
  projectRoot: string;
  config: PDIConfig;
}

export interface UpdateIndexResult {
  indexSize: number;
  created: boolean;
}

/**
 * Build framework index data from docs on disk
 */
export function buildFrameworksIndex(
  frameworks: Record<string, { version: string }>,
  allDocs: Record<string, Record<string, DocFile[]>>
): Record<string, { version: string; categories: Record<string, string[]> }> {
  const frameworksIndex: Record<
    string,
    { version: string; categories: Record<string, string[]> }
  > = {};

  for (const [framework, frameworkConfig] of Object.entries(frameworks)) {
    const docs = allDocs[framework] || {};
    const categories: Record<string, string[]> = {};

    for (const [category, files] of Object.entries(docs)) {
      categories[category] = files.map((f) => f.name);
    }

    frameworksIndex[framework] = {
      version: frameworkConfig.version,
      categories,
    };
  }

  return frameworksIndex;
}

/**
 * Build internal docs index data
 */
export function buildInternalIndex(
  internalDocs: Record<string, DocFile[]>
): Record<string, string[]> {
  const internalIndex: Record<string, string[]> = {};

  for (const [category, files] of Object.entries(internalDocs)) {
    internalIndex[category] = files.map((f) => f.name);
  }

  return internalIndex;
}

/**
 * Update CLAUDE.md index from current config and docs on disk
 * Unified function to replace duplicated code in add.ts, update.ts, generate.ts
 */
export async function updateClaudeMdFromConfig(
  options: UpdateIndexOptions
): Promise<UpdateIndexResult> {
  const { projectRoot, config } = options;

  const allDocs = await readAllFrameworkDocs(projectRoot);
  const internalDocs = await readInternalDocs(projectRoot);

  const frameworksIndex = buildFrameworksIndex(
    config.frameworks ?? {},
    allDocs
  );
  const internalIndex = buildInternalIndex(internalDocs);

  const sections = buildIndexSections(
    `.claude-docs/${FRAMEWORKS_DIR}`,
    `.claude-docs/${INTERNAL_DIR}`,
    frameworksIndex,
    internalIndex
  );

  const indexSize = calculateIndexSize(sections);
  const result = await updateClaudeMdIndex(
    projectRoot,
    sections,
    config?.mcp?.libraryMappings ?? {}
  );

  return {
    indexSize,
    created: result.created,
  };
}
