/**
 * PDI Add Command
 * Downloads documentation for specified frameworks via Context7 (HTTP or MCP)
 */

import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import {
  configExists,
  detectDependencies,
  readConfig,
  readPackageJson,
  updateFrameworkInConfig,
  updateSyncTime,
  writeConfig,
} from "../lib/config.js";
import {
  generateTemplateQueries,
  processContext7Response,
} from "../lib/context7.js";
import { checkAvailability, queryContext7 } from "../lib/context7-client.js";
import { formatSize, writeDocFile } from "../lib/fs-utils.js";
import { updateClaudeMdFromConfig } from "../lib/index-utils.js";
import { getTemplate, hasTemplate, listTemplates } from "../lib/templates.js";
import type { AddOptions, FrameworkConfig } from "../lib/types.js";

export interface ExtendedAddOptions extends AddOptions {
  offline?: boolean;
}

export async function addCommand(
  frameworks: string[],
  options: ExtendedAddOptions
): Promise<void> {
  const projectRoot = process.cwd();
  const spinner = ora();

  // Check if initialized
  if (!(await configExists(projectRoot))) {
    console.log(chalk.red("PDI not initialized. Run: pdi init"));
    return;
  }

  // Read config
  let config = await readConfig(projectRoot);
  if (!config) {
    console.log(chalk.red("Failed to read config"));
    return;
  }

  // Interactive mode if no frameworks specified
  let selectedFrameworks = frameworks;
  if (selectedFrameworks.length === 0) {
    selectedFrameworks = await interactiveFrameworkSelection(
      projectRoot,
      config
    );
    if (selectedFrameworks.length === 0) {
      console.log(chalk.dim("No frameworks selected"));
      return;
    }
  }

  // Validate frameworks
  const validFrameworks: string[] = [];
  const invalidFrameworks: string[] = [];

  for (const framework of selectedFrameworks) {
    if (hasTemplate(framework)) {
      validFrameworks.push(framework);
    } else {
      invalidFrameworks.push(framework);
    }
  }

  if (invalidFrameworks.length > 0) {
    console.log(
      chalk.yellow(`Unknown frameworks: ${invalidFrameworks.join(", ")}`)
    );
    const available = listTemplates().map((t) => t.name).join(", ");
    console.log(chalk.dim(`Available: ${available}`));
  }

  if (validFrameworks.length === 0) {
    console.log(chalk.red("No valid frameworks to add"));
    return;
  }

  // Check availability (unless offline mode)
  let canFetchDocs = false;
  let docSource: "http" | "mcp" | "offline" = "offline";

  if (options.offline) {
    console.log(chalk.dim("Offline mode - generating placeholders"));
  } else {
    spinner.start("Checking documentation sources...");
    const availability = await checkAvailability();

    if (availability.http) {
      canFetchDocs = true;
      docSource = "http";
      spinner.succeed(chalk.green("Using Context7 HTTP API"));
    } else if (availability.mcp) {
      // MCP is available but might fail outside Claude Code
      canFetchDocs = true;
      docSource = "mcp";
      spinner.warn(chalk.yellow("Using MCP (may fail outside Claude Code)"));
      console.log(
        chalk.dim(
          '  Tip: Run "pdi auth" to configure HTTP API for reliable standalone use'
        )
      );
    } else {
      spinner.warn("No documentation source available");
      console.log(chalk.dim('  Run "pdi auth" to configure Context7 API key'));
      console.log(chalk.dim("  Generating placeholders instead..."));
    }
  }

  // Process each framework
  for (const frameworkName of validFrameworks) {
    const template = getTemplate(frameworkName)!;
    const version = options.version || template.version;

    console.log("");
    console.log(
      chalk.bold(`Fetching ${template.displayName}@${version} docs...`)
    );
    console.log(
      chalk.dim(
        `  Source: ${docSource === "http" ? "Context7 HTTP API" : docSource === "mcp" ? "Context7 MCP" : "Placeholders"} (${template.libraryId || "N/A"})`
      )
    );

    // Check if already exists
    if (!options.force && config.frameworks[frameworkName]) {
      console.log(chalk.yellow("  Already exists. Use --force to overwrite."));
      continue;
    }

    const queries = generateTemplateQueries(template);
    let fileCount = 0;
    let totalSize = 0;
    let successCount = 0;
    let fallbackCount = 0;

    for (const query of queries) {
      spinner.start(`  Fetching ${query.category}/${query.file}...`);

      let content: string;
      let fetchedSuccessfully = false;

      // Try to fetch from Context7 if available
      if (canFetchDocs) {
        const result = await queryContext7(query.libraryId, query.query);

        if (result.success && result.content) {
          content = processContext7Response(result.content, {
            framework: template.displayName,
            version,
            category: query.category,
            file: query.file,
            libraryId: query.libraryId,
          });
          successCount++;
          fetchedSuccessfully = true;
        } else {
          // Fallback to placeholder
          content = generatePlaceholderDoc(
            template.displayName,
            template.name,
            version,
            query.category,
            query.file,
            query.query,
            template.libraryId
          );
          fallbackCount++;

          if (result.error) {
            spinner.warn(
              `  ${chalk.yellow("!")} ${query.category}/${query.file} (fallback - ${result.error})`
            );
          }
        }
      } else {
        // Generate placeholder content
        content = generatePlaceholderDoc(
          template.displayName,
          template.name,
          version,
          query.category,
          query.file,
          query.query,
          template.libraryId
        );
        fallbackCount++;
      }

      await writeDocFile(
        projectRoot,
        frameworkName,
        query.category,
        query.file,
        content
      );

      const sizeBytes = Buffer.byteLength(content, "utf-8");
      totalSize += sizeBytes;
      fileCount++;

      // Use per-file status icon based on THIS file's result
      const statusIcon = fetchedSuccessfully
        ? chalk.green("✓")
        : chalk.yellow("○");
      spinner.succeed(
        `  ${statusIcon} ${query.category}/${query.file} (${formatSize(sizeBytes)})`
      );
    }

    // Summary for this framework
    console.log(
      chalk.dim(`  Total: ${fileCount} files, ${formatSize(totalSize)}`)
    );
    if (canFetchDocs) {
      console.log(
        chalk.dim(`  Fetched: ${successCount}, Placeholders: ${fallbackCount}`)
      );
    }

    // Update config
    const frameworkConfig: FrameworkConfig = {
      version,
      source: successCount > 0 ? "context7" : "template",
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
    spinner.start("Updating index in CLAUDE.md...");

    const result = await updateClaudeMdFromConfig({ projectRoot, config });

    if (result.created) {
      spinner.succeed(
        `Created CLAUDE.md with index (${result.indexSize.toFixed(2)}KB)`
      );
    } else {
      spinner.succeed(
        `Updated index in CLAUDE.md (${result.indexSize.toFixed(2)}KB)`
      );
    }
  }

  console.log("");
  console.log(chalk.green("✓ Docs added successfully"));

  if (!canFetchDocs) {
    console.log("");
    console.log(chalk.dim("To fetch real documentation:"));
    console.log(chalk.dim("  1. Get API key from https://context7.com"));
    console.log(chalk.dim("  2. Set: export CONTEXT7_API_KEY=ctx7sk-..."));
    console.log(chalk.dim("  3. Run: pdi update"));
  }
}

function generatePlaceholderDoc(
  displayName: string,
  slug: string,
  version: string,
  category: string,
  fileName: string,
  query: string,
  libraryId?: string
): string {
  const title = fileName.replace(".mdx", "").replace(/-/g, " ");
  const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);

  return `---
# Part of Passive Docs Index for ${displayName}@${version}
# Source: Placeholder (needs CONTEXT7_API_KEY)
# Last updated: ${new Date().toISOString().split("T")[0]}
# Category: ${category}
---

# ${capitalizedTitle}

> This is a placeholder document. Set CONTEXT7_API_KEY and run \`pdi update\` to fetch real content.

## Query for Context7

\`\`\`
Library ID: ${libraryId || "N/A"}
Query: ${query}
\`\`\`

## Setup Instructions

1. Get your free API key from https://context7.com
2. Set the environment variable:
   \`\`\`bash
   export CONTEXT7_API_KEY=ctx7sk-...
   \`\`\`
3. Update docs:
   \`\`\`bash
   pdi update ${slug}
   \`\`\`
`;
}

/**
 * Interactive framework selection when no arguments provided
 */
async function interactiveFrameworkSelection(
  projectRoot: string,
  config: import("../lib/types.js").PDIConfig
): Promise<string[]> {
  console.log(chalk.bold("\nAdd Framework Documentation\n"));

  // Check for detected dependencies
  const packageJson = await readPackageJson(projectRoot);
  const detected = packageJson ? detectDependencies(packageJson) : [];
  const withTemplates = detected.filter(
    (d) => d.framework && hasTemplate(d.framework.name)
  );

  // Get all templates
  const allTemplates = listTemplates();

  // Already installed frameworks
  const installed = new Set(Object.keys(config.frameworks));

  // Build choices
  interface Choice {
    title: string;
    value: string;
    description?: string;
    selected?: boolean;
  }

  const choices: Choice[] = [];

  // Add detected frameworks first (pre-selected)
  if (withTemplates.length > 0) {
    for (const dep of withTemplates) {
      if (!dep.framework) {
        continue;
      }
      const template = getTemplate(dep.framework.name);
      if (!template) {
        continue;
      }

      const isInstalled = installed.has(dep.framework.name);
      choices.push({
        title: `${template.displayName} ${chalk.dim(`@${dep.version || template.version}`)}${isInstalled ? chalk.yellow(" (installed)") : chalk.green(" (detected)")}`,
        value: dep.framework.name,
        description: isInstalled
          ? "Already installed - will be skipped"
          : "Found in package.json",
        selected: !isInstalled,
      });
    }
  }

  // Add remaining templates
  const detectedNames = new Set(withTemplates.map((d) => d.framework?.name));
  for (const template of allTemplates) {
    if (detectedNames.has(template.name)) {
      continue;
    }

    const isInstalled = installed.has(template.name);
    choices.push({
      title: `${template.displayName} ${chalk.dim(`@${template.version}`)}${isInstalled ? chalk.yellow(" (installed)") : ""}`,
      value: template.name,
      description: isInstalled
        ? "Already installed - will be skipped"
        : template.category,
      selected: false,
    });
  }

  if (choices.length === 0) {
    console.log(chalk.dim("No framework templates available"));
    return [];
  }

  // Show hint if detected frameworks
  if (withTemplates.length > 0) {
    console.log(
      chalk.dim(`Found ${withTemplates.length} framework(s) in package.json\n`)
    );
  }

  const response = await prompts({
    type: "multiselect",
    name: "frameworks",
    message: "Select frameworks to add:",
    choices,
    hint: "- Space to select, Enter to confirm",
    instructions: false,
  });

  if (!response.frameworks) {
    return [];
  }

  return response.frameworks;
}
