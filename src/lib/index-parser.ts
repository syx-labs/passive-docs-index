/**
 * Index Parser and Generator
 * Handles the compressed index format in CLAUDE.md
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IndexSection, IndexEntry, IndexCategory } from './types.js';
import { CLAUDE_MD_FILE, PDI_BEGIN_MARKER, PDI_END_MARKER } from './constants.js';

// ============================================================================
// Index Parser
// ============================================================================

/**
 * Parse the compressed index format from a string
 *
 * Format:
 * [Section Title]|root:path
 * |CRITICAL:instruction
 * |package@version|category:{file1.mdx,file2.mdx}|category2:{file3.mdx}
 */
export function parseIndex(content: string): IndexSection[] {
  const sections: IndexSection[] = [];
  let currentSection: IndexSection | null = null;

  const lines = content.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    // Section header: [Title]|root:path
    const sectionMatch = line.match(/^\[([^\]]+)\]\|root:(.+)$/);
    if (sectionMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: sectionMatch[1],
        root: sectionMatch[2],
        criticalInstructions: [],
        entries: [],
      };
      continue;
    }

    if (!currentSection) continue;

    // Critical instruction: |CRITICAL:text
    const criticalMatch = line.match(/^\|CRITICAL:(.+)$/);
    if (criticalMatch) {
      currentSection.criticalInstructions.push(criticalMatch[1]);
      continue;
    }

    // Entry: |package@version|category:{files}|...
    const entryMatch = line.match(/^\|([^@|]+)@([^|]+)\|(.+)$/);
    if (entryMatch) {
      const entry = parseEntry(entryMatch[1], entryMatch[2], entryMatch[3]);
      if (entry) {
        currentSection.entries.push(entry);
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function parseEntry(packageName: string, version: string, categoriesStr: string): IndexEntry | null {
  const categories: IndexCategory[] = [];

  // Match category:{file1,file2} patterns
  const categoryPattern = /([^:{|]+):\{([^}]+)\}/g;
  let match;

  while ((match = categoryPattern.exec(categoriesStr)) !== null) {
    const [, categoryName, filesStr] = match;
    const files = filesStr.split(',').map((f) => f.trim());
    categories.push({
      name: categoryName,
      files,
    });
  }

  if (categories.length === 0) {
    return null;
  }

  return {
    package: packageName,
    version,
    categories,
  };
}

// ============================================================================
// Index Generator
// ============================================================================

/**
 * Generate the compressed index format from sections
 */
export function generateIndex(sections: IndexSection[]): string {
  const lines: string[] = [];

  for (const section of sections) {
    // Section header
    lines.push(`[${section.title}]|root:${section.root}`);

    // Critical instructions
    for (const instruction of section.criticalInstructions) {
      lines.push(`|CRITICAL:${instruction}`);
    }

    // Entries
    for (const entry of section.entries) {
      const categoriesStr = entry.categories
        .map((cat) => `${cat.name}:{${cat.files.join(',')}}`)
        .join('|');
      lines.push(`|${entry.package}@${entry.version}|${categoriesStr}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate the full index block including markers and MCP fallback comment
 */
export function generateIndexBlock(sections: IndexSection[], libraryMappings?: Record<string, string>): string {
  const indexContent = generateIndex(sections);

  const lines = [
    PDI_BEGIN_MARKER,
    indexContent,
    PDI_END_MARKER,
  ];

  // Add MCP fallback comment if mappings exist
  if (libraryMappings && Object.keys(libraryMappings).length > 0) {
    const mappingsStr = Object.entries(libraryMappings)
      .map(([name, id]) => `${name}=${id}`)
      .join(', ');
    lines.push('');
    lines.push(`<!-- MCP Fallback: Context7 for expanded queries`);
    lines.push(`     ${mappingsStr} -->`);
  }

  return lines.join('\n');
}

// ============================================================================
// CLAUDE.md Operations
// ============================================================================

export function getClaudeMdPath(projectRoot: string): string {
  return join(projectRoot, CLAUDE_MD_FILE);
}

export async function claudeMdExists(projectRoot: string): Promise<boolean> {
  return existsSync(getClaudeMdPath(projectRoot));
}

export async function readClaudeMd(projectRoot: string): Promise<string | null> {
  const claudePath = getClaudeMdPath(projectRoot);

  if (!existsSync(claudePath)) {
    return null;
  }

  return await readFile(claudePath, 'utf-8');
}

/**
 * Extract the PDI index from CLAUDE.md content
 */
export function extractIndexFromClaudeMd(content: string): string | null {
  const beginIdx = content.indexOf(PDI_BEGIN_MARKER);
  const endIdx = content.indexOf(PDI_END_MARKER);

  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
    return null;
  }

  // Extract content between markers
  const start = beginIdx + PDI_BEGIN_MARKER.length;
  return content.slice(start, endIdx).trim();
}

/**
 * Update CLAUDE.md with new index content, preserving existing content
 */
export async function updateClaudeMdIndex(
  projectRoot: string,
  sections: IndexSection[],
  libraryMappings?: Record<string, string>
): Promise<{ created: boolean; updated: boolean }> {
  const claudePath = getClaudeMdPath(projectRoot);
  const indexBlock = generateIndexBlock(sections, libraryMappings);

  // Check if CLAUDE.md exists
  if (!existsSync(claudePath)) {
    // Create new CLAUDE.md with index at the end
    const newContent = `# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

---

## Docs Index

${indexBlock}
`;
    await writeFile(claudePath, newContent, 'utf-8');
    return { created: true, updated: false };
  }

  // Read existing content
  const existingContent = await readFile(claudePath, 'utf-8');

  // Check if PDI markers exist
  const beginIdx = existingContent.indexOf(PDI_BEGIN_MARKER);
  const endIdx = existingContent.indexOf(PDI_END_MARKER);

  let newContent: string;

  if (beginIdx !== -1 && endIdx !== -1 && beginIdx < endIdx) {
    // Replace existing index block
    // Find the MCP fallback comment if it exists (it's after pdi:end)
    const afterEnd = existingContent.slice(endIdx + PDI_END_MARKER.length);
    const mcpCommentMatch = afterEnd.match(/^\n*<!-- MCP Fallback:[^>]+-->/);
    const endOfBlock = mcpCommentMatch
      ? endIdx + PDI_END_MARKER.length + mcpCommentMatch[0].length
      : endIdx + PDI_END_MARKER.length;

    newContent =
      existingContent.slice(0, beginIdx) +
      indexBlock +
      existingContent.slice(endOfBlock);
  } else {
    // Append index at the end
    newContent = existingContent.trimEnd() + '\n\n---\n\n## Docs Index\n\n' + indexBlock + '\n';
  }

  await writeFile(claudePath, newContent, 'utf-8');
  return { created: false, updated: true };
}

// ============================================================================
// Index Building Helpers
// ============================================================================

/**
 * Build index sections from the docs structure
 */
export function buildIndexSections(
  frameworksRoot: string,
  internalRoot: string,
  frameworks: Record<string, { version: string; categories: Record<string, string[]> }>,
  internal: Record<string, string[]>,
  options: {
    frameworkCriticals?: string[];
    internalCriticals?: string[];
  } = {}
): IndexSection[] {
  const sections: IndexSection[] = [];

  // Framework docs section
  if (Object.keys(frameworks).length > 0) {
    const entries: IndexEntry[] = Object.entries(frameworks).map(([pkg, data]) => ({
      package: pkg,
      version: data.version,
      categories: Object.entries(data.categories).map(([name, files]) => ({
        name,
        files,
      })),
    }));

    sections.push({
      title: 'Framework Docs',
      root: frameworksRoot,
      criticalInstructions: options.frameworkCriticals || [
        'Prefer retrieval-led reasoning over pre-training-led reasoning',
        'Read the relevant .mdx files BEFORE writing code that uses these libraries',
      ],
      entries,
    });
  }

  // Internal patterns section
  if (Object.keys(internal).length > 0) {
    const entries: IndexEntry[] = [];

    // For internal, we use a single "entry" with all categories
    // This is a slight deviation from the spec but makes more sense
    const categories: IndexCategory[] = Object.entries(internal).map(([name, files]) => ({
      name,
      files,
    }));

    if (categories.length > 0) {
      sections.push({
        title: 'Internal Patterns',
        root: internalRoot,
        criticalInstructions: options.internalCriticals || [
          'Follow these project-specific patterns for consistency',
        ],
        entries: categories.map((cat) => ({
          package: cat.name,
          version: '',
          categories: [{ name: cat.name, files: cat.files }],
        })),
      });
    }
  }

  return sections;
}

/**
 * Calculate the size of the index in KB
 */
export function calculateIndexSize(sections: IndexSection[]): number {
  const content = generateIndexBlock(sections);
  return content.length / 1024;
}
