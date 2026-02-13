/**
 * PDI Update Command
 * Re-fetches documentation for installed frameworks via Context7 (HTTP or MCP)
 */

import chalk from "chalk";
import ora from "ora";
import pLimit from "p-limit";
import prompts from "prompts";
import {
  configExists,
  readConfig,
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
import { getTemplate, hasTemplate } from "../lib/templates.js";
import type { FrameworkConfig } from "../lib/types.js";

export interface UpdateOptions {
  force?: boolean;
  yes?: boolean;
  projectRoot?: string;
}

export async function updateCommand(
  frameworks: string[],
  options: UpdateOptions
): Promise<void> {
  const projectRoot = options.projectRoot || process.cwd();
  const spinner = ora();

  // Check if initialized
  if (!configExists(projectRoot)) {
    throw new Error("PDI not initialized. Run: pdi init");
  }

  // Read config
  let config = await readConfig(projectRoot);
  if (!config) {
    throw new Error("Failed to read config");
  }

  // Determine which frameworks to update
  let frameworksToUpdate: string[];

  if (frameworks.length === 0) {
    // Update all installed frameworks
    frameworksToUpdate = Object.keys(config.frameworks);

    if (frameworksToUpdate.length === 0) {
      console.log(
        chalk.yellow("No frameworks installed. Run: pdi add <framework>")
      );
      return;
    }

    console.log(
      chalk.bold(`Found ${frameworksToUpdate.length} installed framework(s):`)
    );
    for (const fw of frameworksToUpdate) {
      const cfg = config.frameworks[fw] ?? ({} as Partial<FrameworkConfig>);
      console.log(
        `  - ${fw}@${cfg.version ?? "unknown"} (${cfg.files ?? 0} files)`
      );
    }
    console.log("");

    // Confirm unless --yes
    if (!options.yes) {
      const response = await prompts({
        type: "confirm",
        name: "confirm",
        message: "Update all frameworks?",
        initial: true,
      });

      if (response.confirm === undefined || !response.confirm) {
        console.log(chalk.dim("Cancelled."));
        return;
      }
    }
  } else {
    // Validate specified frameworks
    const invalid: string[] = [];
    const valid: string[] = [];

    for (const fw of frameworks) {
      if (config.frameworks[fw]) {
        valid.push(fw);
      } else if (hasTemplate(fw)) {
        console.log(chalk.yellow(`${fw} is not installed. Use: pdi add ${fw}`));
      } else {
        invalid.push(fw);
      }
    }

    if (invalid.length > 0) {
      console.log(chalk.red(`Unknown frameworks: ${invalid.join(", ")}`));
    }

    if (valid.length === 0) {
      console.log(chalk.red("No valid frameworks to update"));
      return;
    }

    frameworksToUpdate = valid;
  }

  // Check availability
  spinner.start("Checking documentation sources...");
  const availability = await checkAvailability();

  if (!availability.available) {
    spinner.fail("No documentation source available");
    console.log("");
    console.log(chalk.dim("To fetch documentation, you need one of:"));
    console.log(
      chalk.dim("  1. Set CONTEXT7_API_KEY (get from https://context7.com)")
    );
    console.log(
      chalk.dim("  2. Run inside Claude Code session (for MCP access)")
    );
    return;
  }

  spinner.succeed(availability.message);

  // Process each framework
  let totalUpdated = 0;
  let totalFailed = 0;

  for (const frameworkName of frameworksToUpdate) {
    const template = getTemplate(frameworkName);

    if (!template) {
      console.log(
        chalk.yellow(`\nNo template found for ${frameworkName}, skipping`)
      );
      continue;
    }

    const existingConfig = config.frameworks[frameworkName];
    const version = existingConfig?.version ?? template.version;

    // Skip recently updated frameworks unless --force is passed
    if (!options.force && existingConfig?.lastUpdate) {
      const hoursSinceUpdate =
        (Date.now() - new Date(existingConfig.lastUpdate).getTime()) /
        (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        console.log(
          chalk.dim(
            `\nSkipping ${template.displayName}@${version} (updated ${Math.round(hoursSinceUpdate)}h ago, use --force to override)`
          )
        );
        continue;
      }
    }

    console.log("");
    console.log(
      chalk.bold(`Updating ${template.displayName}@${version} docs...`)
    );
    console.log(
      chalk.dim(
        `  Source: ${availability.recommended === "http" ? "Context7 HTTP API" : "Context7 MCP"} (${template.libraryId || "N/A"})`
      )
    );

    const queries = generateTemplateQueries(template);
    let totalSize = 0;
    let successCount = 0;
    let failCount = 0;

    const limit = pLimit(5);

    const results = await Promise.all(
      queries.map((query) =>
        limit(async () => {
          try {
            const result = await queryContext7(query.libraryId, query.query);
            if (result.success) {
              const content = processContext7Response(result.content, {
                framework: template.displayName,
                version,
                category: query.category,
                file: query.file,
                libraryId: query.libraryId,
              });
              await writeDocFile(
                projectRoot,
                frameworkName,
                query.category,
                query.file,
                content
              );
              const sizeBytes = Buffer.byteLength(content, "utf-8");
              return { query, success: true as const, sizeBytes };
            }
            return {
              query,
              success: false as const,
              error: result.error,
            };
          } catch (err) {
            return {
              query,
              success: false as const,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        })
      )
    );

    for (const r of results) {
      if (r.success) {
        totalSize += r.sizeBytes;
        successCount++;
        console.log(
          `  ${chalk.green("✓")} ${r.query.category}/${r.query.file} (${formatSize(r.sizeBytes)})`
        );
      } else {
        failCount++;
        console.log(
          `  ${chalk.red("✗")} ${r.query.category}/${r.query.file} (${r.error})`
        );
      }
    }

    // Summary for this framework
    console.log(
      chalk.dim(
        `  Total: ${successCount} files updated, ${formatSize(totalSize)}`
      )
    );

    if (failCount > 0) {
      console.log(chalk.yellow(`  Failed: ${failCount} files`));
      totalFailed += failCount;
    }

    totalUpdated += successCount;

    // Only update config if files were successfully updated
    if (successCount > 0) {
      const frameworkConfig: FrameworkConfig = {
        version,
        source: "context7",
        libraryId: existingConfig?.libraryId ?? template.libraryId,
        lastUpdate: new Date().toISOString(),
        files: successCount,
        categories:
          existingConfig?.categories ?? Object.keys(template.structure),
      };

      config = updateFrameworkInConfig(config, frameworkName, frameworkConfig);
    }
  }

  // Only save config and update index if any files were updated
  if (totalUpdated > 0) {
    config = updateSyncTime(config);
    await writeConfig(projectRoot, config);

    spinner.start("Updating index in CLAUDE.md...");

    const indexResult = await updateClaudeMdFromConfig({ projectRoot, config });

    spinner.succeed(
      `Updated index in CLAUDE.md (${indexResult.indexSize.toFixed(2)}KB)`
    );
  }

  // Final summary
  console.log("");
  if (totalUpdated > 0) {
    console.log(chalk.green("✓ Update complete"));
    console.log(chalk.dim(`  Updated: ${totalUpdated} files`));
  } else {
    console.log(chalk.yellow("No files were updated"));
  }

  if (totalFailed > 0) {
    console.log(chalk.yellow(`  Failed: ${totalFailed} files`));
  }
}
