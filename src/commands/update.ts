/**
 * PDI Update Command
 * Re-fetches documentation for installed frameworks via Context7 (HTTP or MCP)
 */

import chalk from "chalk";
import ora from "ora";
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
}

export async function updateCommand(
  frameworks: string[],
  options: UpdateOptions
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
      const cfg = config.frameworks[fw];
      console.log(`  - ${fw}@${cfg.version} (${cfg.files} files)`);
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
    const version = existingConfig.version || template.version;

    console.log("");
    console.log(
      chalk.bold(`Updating ${template.displayName}@${version} docs...`)
    );
    console.log(
      chalk.dim(
        `  Source: ${availability.recommended === "http" ? "Context7 HTTP API" : "Context7 MCP"} (${template.libraryId})`
      )
    );

    const queries = generateTemplateQueries(template);
    let fileCount = 0;
    let totalSize = 0;
    let successCount = 0;
    let failCount = 0;

    for (const query of queries) {
      spinner.start(`  Fetching ${query.category}/${query.file}...`);

      const result = await queryContext7(query.libraryId, query.query);

      if (result.success && result.content) {
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
        totalSize += sizeBytes;
        fileCount++;
        successCount++;

        spinner.succeed(
          `  ${chalk.green("✓")} ${query.category}/${query.file} (${formatSize(sizeBytes)})`
        );
      } else {
        failCount++;
        spinner.fail(
          `  ${chalk.red("✗")} ${query.category}/${query.file} (${result.error || "unknown error"})`
        );
      }
    }

    // Summary for this framework
    console.log(
      chalk.dim(`  Total: ${fileCount} files updated, ${formatSize(totalSize)}`)
    );

    if (failCount > 0) {
      console.log(chalk.yellow(`  Failed: ${failCount} files`));
      totalFailed += failCount;
    }

    totalUpdated += successCount;

    // Only update config if files were successfully updated
    if (successCount > 0) {
      // Calculate final file count based on existing files as baseline
      // Files that failed to update still exist on disk with previous content
      const finalFiles = Math.max(
        0,
        (existingConfig.files ?? 0) - failCount + successCount
      );

      const frameworkConfig: FrameworkConfig = {
        ...existingConfig,
        source: "context7",
        lastUpdate: new Date().toISOString(),
        files: finalFiles,
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
