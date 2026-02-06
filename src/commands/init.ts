/**
 * PDI Init Command
 * Initializes the PDI structure in a project
 */

import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import {
  configExists,
  createDefaultConfig,
  detectDependencies,
  detectProjectType,
  readPackageJson,
  writeConfig,
} from "../lib/config.js";
import {
  CLAUDE_DOCS_DIR,
  FRAMEWORKS_DIR,
  INTERNAL_DIR,
} from "../lib/constants.js";
import { ensureDir, updateGitignore } from "../lib/fs-utils.js";
import { hasTemplate } from "../lib/templates.js";
import type { DetectedDependency, InitOptions } from "../lib/types.js";

export async function initCommand(options: InitOptions): Promise<void> {
  const projectRoot = options.projectRoot || process.cwd();
  const spinner = ora();

  // Check if already initialized
  if (!options.force && configExists(projectRoot)) {
    console.log(chalk.yellow("PDI already initialized in this project."));
    console.log(chalk.dim("Use --force to reinitialize."));
    return;
  }

  // Read package.json
  spinner.start("Reading package.json...");
  const packageJson = await readPackageJson(projectRoot);

  if (!packageJson) {
    spinner.fail("No package.json found");
    console.log(
      chalk.dim("Please run this command in a Node.js project directory.")
    );
    return;
  }

  spinner.succeed("Found package.json");

  // Detect project type
  const projectType = detectProjectType(packageJson);
  const projectName = packageJson.name || "unnamed-project";

  console.log(chalk.dim(`Project: ${projectName} (${projectType})`));

  // Create directory structure
  spinner.start("Creating .claude-docs/ structure...");

  const docsPath = join(projectRoot, CLAUDE_DOCS_DIR);
  const frameworksPath = join(docsPath, FRAMEWORKS_DIR);
  const internalPath = join(docsPath, INTERNAL_DIR);

  await ensureDir(docsPath);
  await ensureDir(frameworksPath);

  if (options.internal) {
    await ensureDir(internalPath);
  }

  spinner.succeed("Created .claude-docs/");

  // Create config
  spinner.start("Creating config.json...");
  const config = createDefaultConfig(projectName, projectType);
  await writeConfig(projectRoot, config);
  spinner.succeed("Created config.json");

  // Update .gitignore
  const gitignoreUpdated = await updateGitignore(projectRoot);
  if (gitignoreUpdated) {
    console.log(chalk.dim("Updated .gitignore"));
  }

  // Detect dependencies
  if (!options.noDetect) {
    console.log("");
    console.log(chalk.bold("Detected dependencies:"));

    const detected = detectDependencies(packageJson);

    if (detected.length === 0) {
      console.log(chalk.dim("  No supported frameworks detected."));
    } else {
      for (const dep of detected) {
        const templateStatus = hasTemplate(dep.framework?.name || "")
          ? chalk.green("docs available")
          : chalk.yellow("no template");

        const frameworkName = dep.framework?.displayName || dep.name;
        const version = dep.framework?.name
          ? getMajorVersion(dep.version)
          : dep.version;

        console.log(
          `  ${chalk.dim("├──")} ${frameworkName}@${dep.version} → ${frameworkName.toLowerCase()}@${version} ${templateStatus}`
        );
      }

      // Show suggested commands
      console.log("");

      const frameworkNames = detected
        .filter((d) => d.framework && hasTemplate(d.framework.name))
        .map((d) => d.framework?.name);

      if (frameworkNames.length > 0) {
        console.log(chalk.bold("Next steps:"));
        console.log(`  ${chalk.cyan(`pdi add ${frameworkNames.join(" ")}`)}`);
        console.log(chalk.dim("  Or run: pdi sync  (auto-add all detected)"));
      }
    }
  }

  console.log("");
  console.log(chalk.green("✓ PDI initialized successfully"));
}

function getMajorVersion(version: string): string {
  const clean = version.replace(/^[\^~>=<]+/, "");
  const parts = clean.split(".");
  const major = Number.parseInt(parts[0], 10);

  if (major === 0 && parts.length > 1) {
    return `${parts[0]}.${parts[1]}`;
  }

  return `${major}.x`;
}

export function formatDetectedDependencies(deps: DetectedDependency[]): string {
  const lines: string[] = [];

  for (const dep of deps) {
    const frameworkName = dep.framework?.displayName || dep.name;
    const hasTempl = dep.framework && hasTemplate(dep.framework.name);
    const status = hasTempl ? "docs available" : "no template";

    lines.push(`${frameworkName}@${dep.version} → ${status}`);
  }

  return lines.join("\n");
}
