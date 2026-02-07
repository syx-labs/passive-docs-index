/**
 * PDI Status Command
 * Shows current PDI status and documentation overview
 */

import chalk from "chalk";
import {
  configExists,
  detectDependencies,
  getMajorVersion,
  readConfig,
  readPackageJson,
} from "../lib/config.js";
import { FRAMEWORKS_DIR } from "../lib/constants.js";
import {
  calculateDocsSize,
  readAllFrameworkDocs,
  readInternalDocs,
} from "../lib/fs-utils.js";
import { buildIndexSections, calculateIndexSize } from "../lib/index-parser.js";
import {
  buildFrameworksIndex,
  buildInternalIndex,
} from "../lib/index-utils.js";
import { hasTemplate } from "../lib/templates.js";

export async function statusCommand(
  options: { projectRoot?: string } = {}
): Promise<void> {
  const projectRoot = options.projectRoot || process.cwd();

  // Check if initialized
  if (!configExists(projectRoot)) {
    throw new Error("PDI not initialized. Run: pdi init");
  }

  // Read config
  const config = await readConfig(projectRoot);
  if (!config) {
    throw new Error("Failed to read config");
  }

  // Read package.json for comparison
  const packageJson = await readPackageJson(projectRoot);
  const installedDeps = packageJson ? detectDependencies(packageJson) : [];

  // Calculate sizes
  const sizes = await calculateDocsSize(projectRoot);

  // Read docs structure
  const allDocs = await readAllFrameworkDocs(projectRoot);
  const internalDocs = await readInternalDocs(projectRoot);

  // Build index to calculate size
  const frameworksIndex = buildFrameworksIndex(
    config.frameworks || {},
    allDocs
  );
  const internalIndex = buildInternalIndex(internalDocs);

  const sections = buildIndexSections(
    `.claude-docs/${FRAMEWORKS_DIR}`,
    ".claude-docs/internal",
    frameworksIndex,
    internalIndex
  );

  const indexSizeKb = calculateIndexSize(sections);

  // Print header
  console.log("");
  console.log(chalk.bold(`PDI Status for ${config.project.name}`));
  console.log(chalk.dim("═".repeat(40)));
  console.log("");

  // Frameworks section
  console.log(
    chalk.bold("Frameworks") +
      chalk.dim(` (${Object.keys(config.frameworks).length}):`)
  );

  const frameworkEntries = Object.entries(config.frameworks);

  if (frameworkEntries.length === 0) {
    console.log(chalk.dim("  No frameworks configured"));
  } else {
    for (let i = 0; i < frameworkEntries.length; i++) {
      const [name, fw] = frameworkEntries[i];
      const isLast = i === frameworkEntries.length - 1;
      const prefix = isLast ? "└──" : "├──";

      // Check if update available
      const installed = installedDeps.find((d) => d.framework?.name === name);
      const installedVersion = installed
        ? getMajorVersion(installed.version)
        : null;

      let status = chalk.green("✓ up-to-date");
      if (installedVersion && installedVersion !== fw.version) {
        status = chalk.yellow(`⚠ update available (${installedVersion})`);
      }

      const sizeKb = (sizes.frameworks[name] || 0) / 1024;

      console.log(
        `  ${chalk.dim(prefix)} ${name}@${fw.version}  ${chalk.dim(`${fw.files} files`)}  ${chalk.dim(`${sizeKb.toFixed(1)}KB`)}  ${status}`
      );
    }
  }

  // Internal patterns section
  console.log("");
  console.log(
    chalk.bold("Internal Patterns") +
      chalk.dim(` (${config.internal.categories.length} categories):`)
  );

  const internalCategories = Object.entries(internalDocs);

  if (internalCategories.length === 0) {
    console.log(chalk.dim("  No internal patterns configured"));
  } else {
    for (let i = 0; i < internalCategories.length; i++) {
      const [category, files] = internalCategories[i];
      const isLast = i === internalCategories.length - 1;
      const prefix = isLast ? "└──" : "├──";
      const categorySize =
        files.reduce((sum, f) => sum + f.sizeBytes, 0) / 1024;

      console.log(
        `  ${chalk.dim(prefix)} ${category}  ${chalk.dim(`${files.length} files`)}  ${chalk.dim(`${categorySize.toFixed(1)}KB`)}`
      );
    }
  }

  // Index status
  console.log("");
  const percentUsed = (indexSizeKb / config.limits.maxIndexKb) * 100;
  const indexStatus =
    percentUsed > 90
      ? chalk.red(`${percentUsed.toFixed(0)}% used`)
      : percentUsed > 70
        ? chalk.yellow(`${percentUsed.toFixed(0)}% used`)
        : chalk.green(`${percentUsed.toFixed(0)}% used`);

  console.log(
    chalk.bold("Index:") +
      ` ${indexSizeKb.toFixed(2)}KB / ${config.limits.maxIndexKb}KB limit (${indexStatus})`
  );

  // Total docs size
  const totalDocsKb = sizes.total / 1024;
  const docsPercent = (totalDocsKb / config.limits.maxDocsKb) * 100;
  const docsStatus =
    docsPercent > 90
      ? chalk.red(`${docsPercent.toFixed(0)}% of limit`)
      : docsPercent > 70
        ? chalk.yellow(`${docsPercent.toFixed(0)}% of limit`)
        : chalk.green(`${docsPercent.toFixed(0)}% of limit`);

  console.log(
    chalk.bold("Total docs:") +
      ` ${totalDocsKb.toFixed(1)}KB / ${config.limits.maxDocsKb}KB limit (${docsStatus})`
  );

  // Last sync
  console.log("");
  if (config.sync.lastSync) {
    const lastSync = new Date(config.sync.lastSync);
    console.log(chalk.dim(`Last sync: ${lastSync.toLocaleString()}`));
  } else {
    console.log(chalk.dim("Last sync: never"));
  }

  // Missing frameworks
  const missingFrameworks = installedDeps.filter(
    (d) =>
      d.framework &&
      hasTemplate(d.framework.name) &&
      !config.frameworks[d.framework.name]
  );

  if (missingFrameworks.length > 0) {
    console.log("");
    console.log(
      chalk.yellow("Missing frameworks (installed but not documented):")
    );
    for (const dep of missingFrameworks) {
      console.log(
        `  ${chalk.dim("└──")} ${dep.framework?.displayName}@${getMajorVersion(dep.version)}`
      );
    }
    console.log(
      chalk.dim(
        `\nRun: pdi add ${missingFrameworks.map((d) => d.framework?.name).join(" ")}`
      )
    );
  }

  console.log("");
}
