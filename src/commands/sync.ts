/**
 * PDI Sync Command
 * Synchronizes documentation with package.json dependencies
 */

import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import {
  configExists,
  detectDependencies,
  getMajorVersion,
  readConfig,
  readPackageJson,
  removeFrameworkFromConfig,
  updateSyncTime,
  writeConfig,
} from "../lib/config.js";
import { CLAUDE_DOCS_DIR, FRAMEWORKS_DIR } from "../lib/constants.js";
import {
  readAllFrameworkDocs,
  readInternalDocs,
  removeDir,
} from "../lib/fs-utils.js";
import {
  buildIndexSections,
  updateClaudeMdIndex,
} from "../lib/index-parser.js";
import { hasTemplate } from "../lib/templates.js";
import type { SyncOptions } from "../lib/types.js";
import { addCommand } from "./add.js";

interface SyncAction {
  type: "add" | "update" | "remove";
  framework: string;
  currentVersion?: string;
  newVersion?: string;
  reason: string;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
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

  // Read package.json
  const packageJson = await readPackageJson(projectRoot);
  if (!packageJson) {
    console.log(chalk.red("No package.json found"));
    return;
  }

  console.log(chalk.bold("Checking package.json..."));
  console.log("");

  // Detect dependencies and compare
  const installed = detectDependencies(packageJson);
  const actions: SyncAction[] = [];

  // Check existing frameworks
  for (const [name, fw] of Object.entries(config.frameworks)) {
    const dep = installed.find((d) => d.framework?.name === name);

    if (dep) {
      const installedVersion = getMajorVersion(dep.version);
      if (installedVersion !== fw.version) {
        // Version mismatch
        actions.push({
          type: "update",
          framework: name,
          currentVersion: fw.version,
          newVersion: installedVersion,
          reason: `Version changed: ${fw.version} → ${installedVersion}`,
        });
      }
    } else {
      // Framework removed from package.json
      actions.push({
        type: "remove",
        framework: name,
        currentVersion: fw.version,
        reason: "Not in package.json",
      });
    }
  }

  // Check for new frameworks
  for (const dep of installed) {
    if (!(dep.framework && hasTemplate(dep.framework.name))) {
      continue;
    }

    if (!config.frameworks[dep.framework.name]) {
      actions.push({
        type: "add",
        framework: dep.framework.name,
        newVersion: getMajorVersion(dep.version),
        reason: "New dependency detected",
      });
    }
  }

  // Display current status
  for (const dep of installed) {
    if (!dep.framework) {
      continue;
    }

    const name = dep.framework.name;
    const version = getMajorVersion(dep.version);
    const docsVersion = config.frameworks[name]?.version;

    let status: string;
    if (!docsVersion) {
      status = chalk.yellow("NOT DOCUMENTED");
    } else if (docsVersion === version) {
      status = chalk.green("OK");
    } else {
      status = chalk.yellow(`UPDATE AVAILABLE (${docsVersion} → ${version})`);
    }

    console.log(
      `  ${chalk.dim("├──")} ${name}: ${dep.version} → docs: ${docsVersion || "none"} (${status})`
    );
  }

  // Display orphan docs
  const orphans = Object.keys(config.frameworks).filter(
    (name) => !installed.some((d) => d.framework?.name === name)
  );

  if (orphans.length > 0 && options.prune) {
    console.log("");
    console.log(chalk.yellow("Orphan docs (not in package.json):"));
    for (const name of orphans) {
      console.log(`  ${chalk.dim("└──")} ${name}`);
    }
  }

  // Check-only mode
  if (options.check) {
    console.log("");
    if (actions.length === 0) {
      console.log(chalk.green("✓ Everything is in sync"));
    } else {
      console.log(
        chalk.yellow(
          `${actions.length} action(s) needed. Run without --check to apply.`
        )
      );
    }
    return;
  }

  // No actions needed
  if (actions.length === 0) {
    console.log("");
    console.log(chalk.green("✓ Everything is in sync"));

    // Still update sync time
    config = updateSyncTime(config);
    await writeConfig(projectRoot, config);
    return;
  }

  // Show planned actions
  console.log("");
  console.log(chalk.bold("Planned actions:"));

  const addActions = actions.filter((a) => a.type === "add");
  const updateActions = actions.filter((a) => a.type === "update");
  const removeActions = actions.filter((a) => a.type === "remove");

  if (addActions.length > 0) {
    console.log(
      chalk.green(`  Add: ${addActions.map((a) => a.framework).join(", ")}`)
    );
  }
  if (updateActions.length > 0) {
    console.log(
      chalk.yellow(
        `  Update: ${updateActions.map((a) => `${a.framework} (${a.currentVersion} → ${a.newVersion})`).join(", ")}`
      )
    );
  }
  if (removeActions.length > 0 && options.prune) {
    console.log(
      chalk.red(`  Remove: ${removeActions.map((a) => a.framework).join(", ")}`)
    );
  }

  // Confirm
  if (!options.yes) {
    const { confirmed } = await prompts({
      type: "confirm",
      name: "confirmed",
      message: "Apply these changes?",
      initial: true,
    });

    if (!confirmed) {
      console.log(chalk.dim("Cancelled"));
      return;
    }
  }

  console.log("");

  // Execute actions
  // Add new frameworks
  if (addActions.length > 0) {
    const frameworksToAdd = addActions.map((a) => a.framework);
    await addCommand(frameworksToAdd, { noIndex: true });
  }

  // Update frameworks (re-add with force)
  if (updateActions.length > 0) {
    for (const action of updateActions) {
      await addCommand([action.framework], {
        version: action.newVersion,
        force: true,
        noIndex: true,
      });
    }
  }

  // Remove orphans
  if (removeActions.length > 0 && options.prune) {
    for (const action of removeActions) {
      spinner.start(`Removing ${action.framework}...`);

      const frameworkPath = join(
        projectRoot,
        CLAUDE_DOCS_DIR,
        FRAMEWORKS_DIR,
        action.framework
      );
      await removeDir(frameworkPath);
      config = removeFrameworkFromConfig(config, action.framework);

      // Remove from library mappings
      if (config.mcp.libraryMappings) {
        delete config.mcp.libraryMappings[action.framework];
      }

      spinner.succeed(`Removed ${action.framework}`);
    }
  }

  // Re-read config (may have been modified by addCommand)
  config = (await readConfig(projectRoot)) || config;

  // Update index
  spinner.start("Updating index in CLAUDE.md...");

  const allDocs = await readAllFrameworkDocs(projectRoot);
  const internalDocs = await readInternalDocs(projectRoot);

  const frameworksIndex: Record<
    string,
    { version: string; categories: Record<string, string[]> }
  > = {};
  for (const [framework, frameworkConfig] of Object.entries(
    config.frameworks
  )) {
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

  const internalIndex: Record<string, string[]> = {};
  for (const [category, files] of Object.entries(internalDocs)) {
    internalIndex[category] = files.map((f) => f.name);
  }

  const sections = buildIndexSections(
    `.claude-docs/${FRAMEWORKS_DIR}`,
    ".claude-docs/internal",
    frameworksIndex,
    internalIndex
  );

  await updateClaudeMdIndex(projectRoot, sections, config.mcp.libraryMappings);
  spinner.succeed("Updated index in CLAUDE.md");

  // Update sync time and save config
  config = updateSyncTime(config);
  await writeConfig(projectRoot, config);

  console.log("");
  console.log(chalk.green("✓ Sync completed"));
}
