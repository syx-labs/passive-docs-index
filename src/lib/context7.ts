/**
 * Context7 MCP Integration
 * Provides functions to query documentation via Context7 MCP server
 */

import type { FrameworkTemplate } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface Context7Library {
  libraryId: string;
  name: string;
  description?: string;
}

export interface Context7QueryResult {
  content: string;
  source?: string;
}

export interface Context7Options {
  maxTokens?: number;
  topic?: string;
}

// ============================================================================
// Library Resolution
// ============================================================================

/**
 * Resolve a library name to a Context7 library ID
 * This generates the MCP call that Claude would make
 */
export function generateResolveLibraryCall(libraryName: string): string {
  return JSON.stringify({
    tool: 'mcp__plugin_context7_context7__resolve-library-id',
    params: {
      libraryName,
    },
  });
}

/**
 * Generate a query docs call for Context7
 */
export function generateQueryDocsCall(
  libraryId: string,
  query: string,
  options: Context7Options = {}
): string {
  return JSON.stringify({
    tool: 'mcp__plugin_context7_context7__query-docs',
    params: {
      context7CompatibleLibraryID: libraryId,
      topic: options.topic || query,
      tokens: options.maxTokens || 10000,
    },
  });
}

// ============================================================================
// Documentation Fetching
// ============================================================================

/**
 * Generate all the queries needed to fetch documentation for a framework template
 */
export function generateTemplateQueries(
  template: FrameworkTemplate
): Array<{ category: string; file: string; query: string; libraryId: string }> {
  const queries: Array<{ category: string; file: string; query: string; libraryId: string }> = [];

  if (!template.libraryId) {
    return queries;
  }

  for (const [category, files] of Object.entries(template.structure)) {
    for (const [fileName, fileTemplate] of Object.entries(files)) {
      queries.push({
        category,
        file: fileName,
        query: fileTemplate.query,
        libraryId: template.libraryId,
      });
    }
  }

  return queries;
}

// ============================================================================
// Content Processing
// ============================================================================

/**
 * Process raw Context7 response into clean MDX content
 */
export function processContext7Response(
  rawContent: string,
  metadata: {
    framework: string;
    version: string;
    category: string;
    file: string;
    libraryId?: string;
  }
): string {
  // Add frontmatter
  const frontmatter = [
    '---',
    `# Part of Passive Docs Index for ${metadata.framework}@${metadata.version}`,
    `# Source: Context7 (${metadata.libraryId || 'manual'})`,
    `# Last updated: ${new Date().toISOString().split('T')[0]}`,
    `# Category: ${metadata.category}`,
    '---',
    '',
  ].join('\n');

  // Clean up the content
  let content = rawContent;

  // Remove any existing frontmatter from Context7 response
  content = content.replace(/^---[\s\S]*?---\n*/m, '');

  // Ensure proper heading structure
  if (!content.match(/^#\s/m)) {
    const title = metadata.file.replace('.mdx', '').replace(/-/g, ' ');
    const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);
    content = `# ${capitalizedTitle}\n\n${content}`;
  }

  return frontmatter + content;
}

/**
 * Extract the most relevant sections from documentation
 * Used when we need to trim content to fit size limits
 */
export function extractRelevantSections(
  content: string,
  maxLength: number = 8000
): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Split by headings
  const sections = content.split(/(?=^#{1,3}\s)/m);

  // Prioritize: Overview, Quick Start, Basic Usage, Examples
  const priorityPatterns = [
    /overview/i,
    /quick\s*start/i,
    /getting\s*started/i,
    /basic/i,
    /usage/i,
    /example/i,
    /api/i,
  ];

  const prioritized: string[] = [];
  const remaining: string[] = [];

  for (const section of sections) {
    const isPriority = priorityPatterns.some((pattern) => pattern.test(section));
    if (isPriority) {
      prioritized.push(section);
    } else {
      remaining.push(section);
    }
  }

  // Build result within limit
  let result = '';
  const allSections = [...prioritized, ...remaining];

  for (const section of allSections) {
    if (result.length + section.length <= maxLength) {
      result += section;
    } else if (result.length === 0) {
      // At least include first section, truncated
      result = section.slice(0, maxLength);
      break;
    } else {
      break;
    }
  }

  return result;
}

// ============================================================================
// MCP Instructions Generator
// ============================================================================

/**
 * Generate the MCP fallback instructions for CLAUDE.md
 */
export function generateMcpFallbackInstructions(
  libraryMappings: Record<string, string>
): string {
  const mappingsList = Object.entries(libraryMappings)
    .map(([name, id]) => `- ${name}: ${id}`)
    .join('\n');

  return `<!-- MCP Fallback Protocol -->
<!--
When local docs in .claude-docs/ don't answer your question:
1. Query Context7: mcp__plugin_context7_context7__query-docs
2. Use the libraryId from the mappings below
3. If information is valuable, suggest: "Consider running \`pdi sync\` to update local docs"

Library IDs:
${mappingsList}

Only use MCP for:
- Edge cases not covered in local docs
- Very recent API changes
- Integration patterns between libraries
- Bug workarounds
-->`;
}

// ============================================================================
// Batch Query Generator
// ============================================================================

export interface BatchQuery {
  framework: string;
  version: string;
  libraryId: string;
  queries: Array<{
    category: string;
    file: string;
    query: string;
  }>;
}

/**
 * Generate batch queries for multiple frameworks
 * Used by the CLI to show what queries will be made
 */
export function generateBatchQueries(
  templates: FrameworkTemplate[]
): BatchQuery[] {
  return templates
    .filter((t) => t.libraryId)
    .map((template) => ({
      framework: template.name,
      version: template.version,
      libraryId: template.libraryId!,
      queries: generateTemplateQueries(template).map(({ category, file, query }) => ({
        category,
        file,
        query,
      })),
    }));
}
