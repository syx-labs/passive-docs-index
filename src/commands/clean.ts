/**
 * PDI Clean Command
 * Removes orphan docs and optimizes the index
 */

import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import {
  configExists,
  detectDependencies,
  readConfig,
  readPackageJson,
  removeFrameworkFromConfig,
  writeConfig,
} from "../lib/config.js";
import { CLAUDE_DOCS_DIR, FRAMEWORKS_DIR } from "../lib/constants.js";
import {
  calculateDocsSize,
  formatSize,
  readAllFrameworkDocs,
  readInternalDocs,
  removeDir,
} from "../lib/fs-utils.js";
import {
  buildIndexSections,
  calculateIndexSize,
  updateClaudeMdIndex,
} from "../lib/index-parser.js";
import {
  buildFrameworksIndex,
  buildInternalIndex,
} from "../lib/index-utils.js";

interface CleanOptions {
  yes?: boolean;
  dryRun?: boolean;
  projectRoot?: string;
}

export async function cleanCommand(options: CleanOptions = {}): Promise<void> {
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

  // Read package.json
  const packageJson = await readPackageJson(projectRoot);
  const installed = packageJson ? detectDependencies(packageJson) : [];

  // Find orphan docs
  const orphans: Array<{ name: string; sizeBytes: number }> = [];
  const sizes = await calculateDocsSize(projectRoot);

  for (const [framework, sizeBytes] of Object.entries(sizes.frameworks)) {
    const isInstalled = installed.some((d) => d.framework?.name === framework);
    const isConfigured = framework in config.frameworks;

    // Orphan if in docs but not in package.json and not manually configured
    if (!isInstalled && isConfigured) {
      orphans.push({ name: framework, sizeBytes });
    }
  }

  // Calculate index size before
  const allDocsBefore = await readAllFrameworkDocs(projectRoot);
  const internalDocs = await readInternalDocs(projectRoot);

  const frameworksIndexBefore = buildFrameworksIndex(
    config.frameworks,
    allDocsBefore
  );
  const internalIndex = buildInternalIndex(internalDocs);

  const sectionsBefore = buildIndexSections(
    `.claude-docs/${FRAMEWORKS_DIR}`,
    ".claude-docs/internal",
    frameworksIndexBefore,
    internalIndex
  );

  const indexSizeBefore = calculateIndexSize(sectionsBefore);

  // Display findings
  console.log(chalk.bold("PDI Clean"));
  console.log("");

  if (orphans.length === 0) {
    console.log(chalk.green("✓ No orphan docs found"));
  } else {
    console.log(chalk.yellow("Found orphan docs:"));
    let totalOrphanSize = 0;
    for (const orphan of orphans) {
      console.log(
        `  ${chalk.dim("└──")} ${orphan.name} (${formatSize(orphan.sizeBytes)})`
      );
      totalOrphanSize += orphan.sizeBytes;
    }
    console.log(chalk.dim(`  Total: ${formatSize(totalOrphanSize)}`));
  }

  // Dry run mode
  if (options.dryRun) {
    console.log("");
    console.log(chalk.dim("Dry run mode - no changes made"));
    return;
  }

  // Nothing to clean
  if (orphans.length === 0) {
    // Still optimize index
    console.log("");
    spinner.start("Optimizing index...");

    const sectionsAfter = buildIndexSections(
      `.claude-docs/${FRAMEWORKS_DIR}`,
      ".claude-docs/internal",
      frameworksIndexBefore,
      internalIndex
    );

    const indexSizeAfter = calculateIndexSize(sectionsAfter);

    await updateClaudeMdIndex(
      projectRoot,
      sectionsAfter,
      config.mcp?.libraryMappings ?? {}
    );

    if (indexSizeBefore > indexSizeAfter) {
      const saved = indexSizeBefore - indexSizeAfter;
      spinner.succeed(
        `Optimized index (saved ${(saved * 1024).toFixed(0)} bytes)`
      );
    } else {
      spinner.succeed("Index already optimized");
    }

    return;
  }

  // Confirm removal
  if (!options.yes) {
    console.log("");
    const { confirmed } = await prompts({
      type: "confirm",
      name: "confirmed",
      message: "Remove orphan docs?",
      initial: false,
    });

    if (!confirmed) {
      console.log(chalk.dim("Cancelled"));
      return;
    }
  }

  console.log("");

  // Remove orphans
  let totalRemoved = 0;
  for (const orphan of orphans) {
    spinner.start(`Removing ${orphan.name}...`);

    const frameworkPath = join(
      projectRoot,
      CLAUDE_DOCS_DIR,
      FRAMEWORKS_DIR,
      orphan.name
    );
    await removeDir(frameworkPath);
    config = removeFrameworkFromConfig(config, orphan.name);

    // Remove from library mappings
    if (config.mcp?.libraryMappings) {
      delete config.mcp.libraryMappings[orphan.name];
    }

    totalRemoved += orphan.sizeBytes;
    spinner.succeed(`Removed ${orphan.name} (${formatSize(orphan.sizeBytes)})`);
  }

  // Rebuild index
  spinner.start("Rebuilding index...");

  const allDocsAfter = await readAllFrameworkDocs(projectRoot);

  const frameworksIndexAfter = buildFrameworksIndex(
    config.frameworks,
    allDocsAfter
  );

  const sectionsAfter = buildIndexSections(
    `.claude-docs/${FRAMEWORKS_DIR}`,
    ".claude-docs/internal",
    frameworksIndexAfter,
    internalIndex
  );

  const indexSizeAfter = calculateIndexSize(sectionsAfter);

  await updateClaudeMdIndex(
    projectRoot,
    sectionsAfter,
    config.mcp?.libraryMappings ?? {}
  );
  await writeConfig(projectRoot, config);

  spinner.succeed("Rebuilt index");

  // Summary
  console.log("");
  console.log(chalk.bold("Index optimization:"));
  console.log(`  Before: ${indexSizeBefore.toFixed(2)}KB`);
  console.log(`  After: ${indexSizeAfter.toFixed(2)}KB`);

  const savedKb = indexSizeBefore - indexSizeAfter;
  if (savedKb > 0) {
    const percent = ((savedKb / indexSizeBefore) * 100).toFixed(0);
    console.log(
      `  ${chalk.green(`Saved: ${savedKb.toFixed(2)}KB (${percent}%)`)}`
    );
  }

  console.log("");
  console.log(
    chalk.green(
      `✓ Cleaned ${orphans.length} orphan(s), freed ${formatSize(totalRemoved)}`
    )
  );
}
