/**
 * Configuration Management
 * Read/write config.json and detect project settings
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CLAUDE_DOCS_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  KNOWN_FRAMEWORKS,
  PROJECT_TYPE_INDICATORS,
} from "./constants.js";
import { hasTemplate } from "./templates.js";
import type { DetectedDependency, PDIConfig, ProjectConfig } from "./types.js";

// ============================================================================
// Config File Operations
// ============================================================================

export function getConfigPath(projectRoot: string): string {
  return join(projectRoot, CLAUDE_DOCS_DIR, CONFIG_FILE);
}

export function getDocsPath(projectRoot: string): string {
  return join(projectRoot, CLAUDE_DOCS_DIR);
}

export function configExists(projectRoot: string): boolean {
  return existsSync(getConfigPath(projectRoot));
}

export async function readConfig(
  projectRoot: string
): Promise<PDIConfig | null> {
  const configPath = getConfigPath(projectRoot);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content) as PDIConfig;
  } catch (error) {
    throw new Error(
      `Failed to read config: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function writeConfig(
  projectRoot: string,
  config: PDIConfig
): Promise<void> {
  const configPath = getConfigPath(projectRoot);
  const configDir = dirname(configPath);

  // Ensure directory exists
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }

  const content = JSON.stringify(config, null, 2);
  await writeFile(configPath, content, "utf-8");
}

export function createDefaultConfig(
  projectName: string,
  projectType: ProjectConfig["type"]
): PDIConfig {
  return {
    ...DEFAULT_CONFIG,
    project: {
      name: projectName,
      type: projectType,
    },
    sync: {
      ...DEFAULT_CONFIG.sync,
      lastSync: null,
    },
    frameworks: {},
    internal: {
      ...DEFAULT_CONFIG.internal,
    },
  };
}

// ============================================================================
// Package.json Operations
// ============================================================================

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  bin?: Record<string, string> | string;
  main?: string;
  exports?: unknown;
}

export async function readPackageJson(
  projectRoot: string
): Promise<PackageJson | null> {
  const packagePath = join(projectRoot, "package.json");

  if (!existsSync(packagePath)) {
    return null;
  }

  try {
    const content = await readFile(packagePath, "utf-8");
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    throw new Error(
      `Failed to parse package.json: ${error instanceof Error ? error.message : error}`
    );
  }
}

export function detectProjectType(
  packageJson: PackageJson
): ProjectConfig["type"] {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const depNames = Object.keys(allDeps);

  // Check if it's a library (has exports or main)
  if (packageJson.exports || packageJson.main) {
    // But not if it has frontend/backend indicators
    const hasAppIndicators = depNames.some(
      (dep) =>
        PROJECT_TYPE_INDICATORS.backend.includes(dep) ||
        PROJECT_TYPE_INDICATORS.frontend.includes(dep) ||
        PROJECT_TYPE_INDICATORS.fullstack.includes(dep)
    );

    if (!hasAppIndicators) {
      return "library";
    }
  }

  // Check if it's a CLI
  if (packageJson.bin) {
    return "cli";
  }

  // Check for fullstack first (most specific)
  if (depNames.some((dep) => PROJECT_TYPE_INDICATORS.fullstack.includes(dep))) {
    return "fullstack";
  }

  // Check for backend and frontend
  const hasBackend = depNames.some((dep) =>
    PROJECT_TYPE_INDICATORS.backend.includes(dep)
  );
  const hasFrontend = depNames.some((dep) =>
    PROJECT_TYPE_INDICATORS.frontend.includes(dep)
  );

  if (hasBackend && hasFrontend) {
    return "fullstack";
  }

  if (hasBackend) {
    return "backend";
  }

  if (hasFrontend) {
    return "frontend";
  }

  // Default to backend
  return "backend";
}

// ============================================================================
// Dependency Detection
// ============================================================================

export function detectDependencies(
  packageJson: PackageJson
): DetectedDependency[] {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const detected: DetectedDependency[] = [];
  const seenFrameworks = new Set<string>();

  for (const [name, version] of Object.entries(allDeps)) {
    const framework = KNOWN_FRAMEWORKS.find((f) => f.pattern.test(name));

    if (framework && !seenFrameworks.has(framework.name)) {
      seenFrameworks.add(framework.name);
      detected.push({
        name,
        version: cleanVersion(version),
        framework,
        hasTemplate: hasTemplate(framework.name),
      });
    }
  }

  return detected;
}

export function cleanVersion(version: string): string {
  // Remove ^ ~ >= <= > < = prefixes
  return version.replace(/^[\^~>=<]+/, "");
}

export function getMajorVersion(version: string): string {
  const clean = cleanVersion(version);
  const parts = clean.split(".");
  const major = Number.parseInt(parts[0], 10);

  // For versions < 1.0, use major.minor
  if (major === 0 && parts.length > 1) {
    return `${parts[0]}.${parts[1]}`;
  }

  return `${major}.x`;
}

// ============================================================================
// Config Update Helpers
// ============================================================================

export function updateFrameworkInConfig(
  config: PDIConfig,
  frameworkName: string,
  update: Partial<PDIConfig["frameworks"][string]>
): PDIConfig {
  return {
    ...config,
    frameworks: {
      ...config.frameworks,
      [frameworkName]: {
        ...config.frameworks[frameworkName],
        ...update,
      },
    },
  };
}

export function removeFrameworkFromConfig(
  config: PDIConfig,
  frameworkName: string
): PDIConfig {
  const { [frameworkName]: _, ...remainingFrameworks } = config.frameworks;
  return {
    ...config,
    frameworks: remainingFrameworks,
  };
}

export function updateSyncTime(config: PDIConfig): PDIConfig {
  return {
    ...config,
    sync: {
      ...config.sync,
      lastSync: new Date().toISOString(),
    },
  };
}
