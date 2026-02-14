/**
 * Freshness Checking Module
 * Compares indexed documentation versions against the latest npm registry versions.
 * Detects stale, missing, and orphaned framework documentation.
 */

import semver from "semver";
import { KNOWN_FRAMEWORKS } from "./constants.js";
import { fetchLatestVersions } from "./registry-client.js";
import type { PDIConfig } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

export const EXIT_CODES = {
  SUCCESS: 0,
  STALE: 1,
  MISSING: 2,
  ORPHANED: 3,
  MIXED: 4,
  NETWORK_ERROR: 5,
} as const;

const DEFAULT_STALE_DAYS = 30;

// ============================================================================
// Types
// ============================================================================

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
export type FreshnessStatus =
  | "up-to-date"
  | "stale"
  | "missing"
  | "orphaned"
  | "unknown";

export interface FreshnessResult {
  framework: string;
  displayName: string;
  indexedVersion: string;
  latestVersion: string | null;
  status: FreshnessStatus;
  diffType: string | null;
}

export interface FreshnessCheckOutput {
  results: FreshnessResult[];
  exitCode: ExitCode;
  summary: {
    total: number;
    stale: number;
    missing: number;
    orphaned: number;
    upToDate: number;
    unknown: number;
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compare an indexed version against the latest version using semver.
 * Only major and minor differences are considered stale; patch is acceptable.
 *
 * Uses semver.coerce() to handle loose version strings (e.g., "18.x", "v19", "4").
 * Returns { isStale: false, diffType: "uncoercible" } for un-coercible versions.
 */
export function checkVersionFreshness(
  indexedVersion: string,
  latestVersion: string
): { isStale: boolean; diffType: string | null } {
  const coercedIndexed = semver.coerce(indexedVersion);
  const coercedLatest = semver.coerce(latestVersion);

  if (!(coercedIndexed && coercedLatest)) {
    return { isStale: false, diffType: "uncoercible" };
  }

  const diff = semver.diff(coercedIndexed, coercedLatest);

  if (!diff) {
    // Identical versions
    return { isStale: false, diffType: null };
  }

  const staleTypes = new Set(["major", "minor", "premajor", "preminor"]);

  return {
    isStale: staleTypes.has(diff),
    diffType: diff,
  };
}

/**
 * Perform a full freshness check of all indexed frameworks.
 *
 * Checks:
 * 1. Each framework in config vs latest npm version -> "up-to-date" or "stale"
 * 2. Frameworks in config but not in package.json -> "orphaned"
 * 3. Known frameworks in package.json but not in config -> "missing"
 * 4. Frameworks without npm mapping -> timestamp-based staleness check
 *
 * @param config - The PDI configuration
 * @param packageJson - The project's package.json (or null if unavailable)
 * @param options - Optional settings (staleDays for timestamp-based checks)
 * @returns FreshnessCheckOutput with results, exit code, and summary
 */
export async function checkFreshness(
  config: PDIConfig,
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null,
  options?: {
    staleDays?: number;
    fetchVersionsFn?: (
      names: string[]
    ) => Promise<Map<string, string | null>>;
  }
): Promise<FreshnessCheckOutput> {
  const staleDays = options?.staleDays ?? DEFAULT_STALE_DAYS;
  const fetchVersions = options?.fetchVersionsFn ?? fetchLatestVersions;
  const results: FreshnessResult[] = [];

  // Merge all dependencies from package.json
  const allDeps: Record<string, string> = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };

  // Build reverse mappings: frameworkName -> npmPackageName, npmPackageName -> KnownFramework
  const frameworkToNpm = buildFrameworkToNpmMap();
  const npmToFramework = buildNpmToFrameworkMap();

  // Collect npm package names we need to look up
  const npmPackagesToFetch: string[] = [];
  for (const frameworkName of Object.keys(config.frameworks)) {
    const npmPkg = frameworkToNpm.get(frameworkName);
    if (npmPkg) {
      npmPackagesToFetch.push(npmPkg);
    }
  }

  // Fetch latest versions from registry
  let latestVersions: Map<string, string | null>;
  try {
    latestVersions = await fetchVersions(npmPackagesToFetch);
  } catch (error) {
    console.error("Failed to fetch versions from registry:", error);
    return {
      results: [],
      exitCode: EXIT_CODES.NETWORK_ERROR,
      summary: {
        total: 0,
        stale: 0,
        missing: 0,
        orphaned: 0,
        upToDate: 0,
        unknown: 0,
      },
    };
  }

  // Track which framework names have been processed (to avoid duplicates)
  const processedFrameworks = new Set<string>();

  // ---- Check each framework in config ----
  for (const [frameworkName, frameworkConfig] of Object.entries(
    config.frameworks
  )) {
    processedFrameworks.add(frameworkName);

    const npmPkg = frameworkToNpm.get(frameworkName);
    const knownFw = findKnownFramework(frameworkName);
    const displayName = knownFw?.displayName ?? frameworkName;

    // Check if the framework's npm package exists in package.json deps
    const isInDeps = npmPkg ? npmPkg in allDeps : frameworkName in allDeps;

    if (!isInDeps) {
      // Framework is in config but not in package.json -> orphaned
      results.push({
        framework: frameworkName,
        displayName,
        indexedVersion: frameworkConfig.version,
        latestVersion: npmPkg ? (latestVersions.get(npmPkg) ?? null) : null,
        status: "orphaned",
        diffType: null,
      });
      continue;
    }

    if (npmPkg) {
      // Known framework with npm package -> version-based check
      const latest = latestVersions.get(npmPkg) ?? null;

      if (latest) {
        const { isStale, diffType } = checkVersionFreshness(
          frameworkConfig.version,
          latest
        );

        results.push({
          framework: frameworkName,
          displayName,
          indexedVersion: frameworkConfig.version,
          latestVersion: latest,
          status: isStale ? "stale" : "up-to-date",
          diffType,
        });
      } else {
        // Could not fetch latest version -> unknown (cannot verify freshness)
        results.push({
          framework: frameworkName,
          displayName,
          indexedVersion: frameworkConfig.version,
          latestVersion: null,
          status: "unknown",
          diffType: "fetch-failed",
        });
      }
    } else {
      // Unknown framework (no npm mapping) -> timestamp-based check
      const lastUpdateDate = new Date(frameworkConfig.lastUpdate);
      const isValidDate = !Number.isNaN(lastUpdateDate.getTime());

      if (!isValidDate) {
        results.push({
          framework: frameworkName,
          displayName,
          indexedVersion: frameworkConfig.version,
          latestVersion: null,
          status: "stale",
          diffType: "invalid-timestamp",
        });
        continue;
      }

      const daysSinceUpdate = Math.floor(
        (Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isStale = daysSinceUpdate > staleDays;

      results.push({
        framework: frameworkName,
        displayName,
        indexedVersion: frameworkConfig.version,
        latestVersion: null,
        status: isStale ? "stale" : "up-to-date",
        diffType: isStale ? "timestamp" : null,
      });
    }
  }

  // ---- Detect missing frameworks (in package.json but not in config) ----
  for (const depName of Object.keys(allDeps)) {
    const matched = npmToFramework.get(depName);
    if (matched && !processedFrameworks.has(matched.name)) {
      processedFrameworks.add(matched.name);
      results.push({
        framework: matched.name,
        displayName: matched.displayName,
        indexedVersion: "",
        latestVersion: null,
        status: "missing",
        diffType: null,
      });
    }
  }

  // ---- Compute summary and exit code ----
  const summary = {
    total: results.length,
    stale: results.filter((r) => r.status === "stale").length,
    missing: results.filter((r) => r.status === "missing").length,
    orphaned: results.filter((r) => r.status === "orphaned").length,
    upToDate: results.filter((r) => r.status === "up-to-date").length,
    unknown: results.filter((r) => r.status === "unknown").length,
  };

  const exitCode = computeExitCode(summary);

  return { results, exitCode, summary };
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Build a map from framework name to its primary npm package name.
 * Extracts the package name from the regex pattern source by stripping anchors.
 * Only uses patterns that start with `^` and end with `$` (exact matches).
 */
function buildFrameworkToNpmMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const fw of KNOWN_FRAMEWORKS) {
    // Only consider exact-match patterns (^package-name$)
    const source = fw.pattern.source;
    if (source.startsWith("^") && source.endsWith("$")) {
      const npmPkg = source
        .slice(1, -1) // Remove ^ and $
        .replace(/\\\//g, "/"); // Un-escape forward slashes

      // Only set if not already mapped (first match is primary)
      if (!map.has(fw.name)) {
        map.set(fw.name, npmPkg);
      }
    }
  }

  return map;
}

/**
 * Build a map from npm package name to its KNOWN_FRAMEWORK entry.
 * Only uses exact-match patterns (`^package-name$`), same as buildFrameworkToNpmMap.
 * Prefix patterns are not included as they cannot be reliably reverse-mapped.
 */
function buildNpmToFrameworkMap(): Map<
  string,
  { name: string; displayName: string }
> {
  const map = new Map<string, { name: string; displayName: string }>();

  for (const fw of KNOWN_FRAMEWORKS) {
    const source = fw.pattern.source;
    if (source.startsWith("^") && source.endsWith("$")) {
      const npmPkg = source.slice(1, -1).replace(/\\\//g, "/");
      if (!map.has(npmPkg)) {
        map.set(npmPkg, { name: fw.name, displayName: fw.displayName });
      }
    }
  }

  return map;
}

/**
 * Find a KNOWN_FRAMEWORK entry by framework name.
 */
function findKnownFramework(
  frameworkName: string
): { name: string; displayName: string } | undefined {
  return KNOWN_FRAMEWORKS.find((fw) => fw.name === frameworkName);
}

/**
 * Compute the exit code from the summary counts.
 */
function computeExitCode(summary: {
  stale: number;
  missing: number;
  orphaned: number;
}): ExitCode {
  const problemTypes = [
    summary.stale > 0,
    summary.missing > 0,
    summary.orphaned > 0,
  ].filter(Boolean).length;

  if (problemTypes === 0) {
    return EXIT_CODES.SUCCESS;
  }
  if (problemTypes > 1) {
    return EXIT_CODES.MIXED;
  }

  // Single problem type
  if (summary.stale > 0) {
    return EXIT_CODES.STALE;
  }
  if (summary.missing > 0) {
    return EXIT_CODES.MISSING;
  }
  if (summary.orphaned > 0) {
    return EXIT_CODES.ORPHANED;
  }

  return EXIT_CODES.SUCCESS;
}
