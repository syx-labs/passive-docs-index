/**
 * PDI Add Command
 * Downloads documentation for specified frameworks
 */

import { join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import type { AddOptions, FrameworkConfig, IndexSection } from '../lib/types.js';
import {
  readConfig,
  writeConfig,
  configExists,
  getMajorVersion,
  updateFrameworkInConfig,
  updateSyncTime,
} from '../lib/config.js';
import { getTemplate, hasTemplate } from '../lib/templates.js';
import {
  generateTemplateQueries,
  processContext7Response,
} from '../lib/context7.js';
import {
  writeDocFile,
  ensureDir,
  formatSize,
  readAllFrameworkDocs,
  readInternalDocs,
} from '../lib/fs-utils.js';
import {
  buildIndexSections,
  updateClaudeMdIndex,
  calculateIndexSize,
} from '../lib/index-parser.js';
import {
  CLAUDE_DOCS_DIR,
  FRAMEWORKS_DIR,
  KNOWN_FRAMEWORKS,
} from '../lib/constants.js';

export async function addCommand(
  frameworks: string[],
  options: AddOptions
): Promise<void> {
  const projectRoot = process.cwd();
  const spinner = ora();

  // Check if initialized
  if (!(await configExists(projectRoot))) {
    console.log(chalk.red('PDI not initialized. Run: pdi init'));
    return;
  }

  // Read config
  let config = await readConfig(projectRoot);
  if (!config) {
    console.log(chalk.red('Failed to read config'));
    return;
  }

  // Validate frameworks
  const validFrameworks: string[] = [];
  const invalidFrameworks: string[] = [];

  for (const framework of frameworks) {
    if (hasTemplate(framework)) {
      validFrameworks.push(framework);
    } else {
      invalidFrameworks.push(framework);
    }
  }

  if (invalidFrameworks.length > 0) {
    console.log(chalk.yellow(`Unknown frameworks: ${invalidFrameworks.join(', ')}`));
    console.log(chalk.dim('Available: hono, drizzle, better-auth, zod, tanstack-query, tanstack-router, react, vite, vitest, tailwind'));
  }

  if (validFrameworks.length === 0) {
    console.log(chalk.red('No valid frameworks to add'));
    return;
  }

  // Process each framework
  for (const frameworkName of validFrameworks) {
    const template = getTemplate(frameworkName)!;
    const version = options.version || template.version;

    console.log('');
    console.log(chalk.bold(`Fetching ${template.displayName}@${version} docs...`));
    console.log(chalk.dim(`  Source: Context7 (${template.libraryId})`));

    // Check if already exists
    if (!options.force && config.frameworks[frameworkName]) {
      console.log(chalk.yellow(`  Already exists. Use --force to overwrite.`));
      continue;
    }

    // Generate placeholder docs (since we can't actually call Context7 from CLI)
    // In real usage, Claude would populate these via MCP
    const queries = generateTemplateQueries(template);
    let fileCount = 0;
    let totalSize = 0;

    for (const query of queries) {
      spinner.start(`  Creating ${query.category}/${query.file}...`);

      // Generate placeholder content
      const content = generatePlaceholderDoc(
        template.displayName,
        version,
        query.category,
        query.file,
        query.query,
        template.libraryId
      );

      const filePath = await writeDocFile(
        projectRoot,
        frameworkName,
        query.category,
        query.file,
        content
      );

      const sizeBytes = Buffer.byteLength(content, 'utf-8');
      totalSize += sizeBytes;
      fileCount++;

      spinner.succeed(`  ${chalk.green('✓')} ${query.category}/${query.file} (${formatSize(sizeBytes)})`);
    }

    console.log(chalk.dim(`  Total: ${fileCount} files, ${formatSize(totalSize)}`));

    // Update config
    const frameworkConfig: FrameworkConfig = {
      version,
      source: 'context7',
      libraryId: template.libraryId,
      lastUpdate: new Date().toISOString(),
      files: fileCount,
      categories: Object.keys(template.structure),
    };

    config = updateFrameworkInConfig(config, frameworkName, frameworkConfig);

    // Update library mappings
    if (template.libraryId) {
      config.mcp.libraryMappings = {
        ...config.mcp.libraryMappings,
        [frameworkName]: template.libraryId,
      };
    }
  }

  // Save config
  config = updateSyncTime(config);
  await writeConfig(projectRoot, config);

  // Update index in CLAUDE.md
  if (!options.noIndex) {
    spinner.start('Updating index in CLAUDE.md...');

    const allDocs = await readAllFrameworkDocs(projectRoot);
    const internalDocs = await readInternalDocs(projectRoot);

    // Build framework index data
    const frameworksIndex: Record<string, { version: string; categories: Record<string, string[]> }> = {};

    for (const [framework, frameworkConfig] of Object.entries(config.frameworks)) {
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

    // Build internal index data
    const internalIndex: Record<string, string[]> = {};
    for (const [category, files] of Object.entries(internalDocs)) {
      internalIndex[category] = files.map((f) => f.name);
    }

    const sections = buildIndexSections(
      `.claude-docs/${FRAMEWORKS_DIR}`,
      `.claude-docs/internal`,
      frameworksIndex,
      internalIndex
    );

    const indexSize = calculateIndexSize(sections);
    const result = await updateClaudeMdIndex(
      projectRoot,
      sections,
      config.mcp.libraryMappings
    );

    if (result.created) {
      spinner.succeed(`Created CLAUDE.md with index (${indexSize.toFixed(2)}KB)`);
    } else {
      spinner.succeed(`Updated index in CLAUDE.md (${indexSize.toFixed(2)}KB)`);
    }
  }

  console.log('');
  console.log(chalk.green('✓ Docs added successfully'));
  console.log(chalk.dim('Note: Placeholder docs created. Use Claude to populate via Context7 MCP.'));
}

function generatePlaceholderDoc(
  frameworkName: string,
  version: string,
  category: string,
  fileName: string,
  query: string,
  libraryId?: string
): string {
  const title = fileName.replace('.mdx', '').replace(/-/g, ' ');
  const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);

  return `---
# Part of Passive Docs Index for ${frameworkName}@${version}
# Source: Context7 (${libraryId || 'manual'})
# Last updated: ${new Date().toISOString().split('T')[0]}
# Category: ${category}
---

# ${capitalizedTitle}

> This is a placeholder document. Ask Claude to populate it using Context7 MCP.

## Query for Context7

To populate this document, use the following query with Context7:

\`\`\`
Library ID: ${libraryId}
Query: ${query}
\`\`\`

## How to Populate

Ask Claude:
"Please use Context7 to fetch documentation for ${frameworkName} about ${query.toLowerCase()} and update this file."

Or run:
\`\`\`bash
# Claude will use MCP to fetch and update
pdi sync --populate
\`\`\`
`;
}
