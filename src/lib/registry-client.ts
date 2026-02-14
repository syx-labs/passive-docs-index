/**
 * NPM Registry Client
 * Fetches latest package version information from the npm registry.
 * Uses abbreviated metadata for performance and p-limit for concurrency control.
 */

import pLimit from "p-limit";

// ============================================================================
// Constants
// ============================================================================

export const NPM_REGISTRY_URL = "https://registry.npmjs.org";

const ABBREVIATED_METADATA_ACCEPT =
  "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*";

const REQUEST_TIMEOUT_MS = 5000;
const MAX_CONCURRENCY = 5;

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch the latest published version of an npm package.
 *
 * @param packageName - The npm package name (supports scoped packages like `@tanstack/react-query`)
 * @returns The latest version string, or null if the package is not found (404)
 * @throws On non-404 HTTP errors or network failures
 */
export async function fetchLatestVersion(
  packageName: string
): Promise<string | null> {
  const encodedName = encodePackageName(packageName);
  const url = `${NPM_REGISTRY_URL}/${encodedName}`;

  const response = await fetch(url, {
    headers: {
      Accept: ABBREVIATED_METADATA_ACCEPT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `npm registry error for "${packageName}": HTTP ${response.status}`
    );
  }

  const data = (await response.json()) as {
    "dist-tags"?: { latest?: string };
  };

  return data["dist-tags"]?.latest ?? null;
}

/**
 * Fetch latest versions for multiple packages concurrently.
 * Uses p-limit to cap concurrency at 5 parallel requests.
 * Individual fetch errors are caught and mapped to null (not re-thrown).
 *
 * @param packageNames - Array of npm package names
 * @returns Map from package name to latest version (or null on 404/error)
 */
export async function fetchLatestVersions(
  packageNames: string[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  if (packageNames.length === 0) {
    return results;
  }

  const limit = pLimit(MAX_CONCURRENCY);

  const tasks = packageNames.map((name) =>
    limit(async () => {
      try {
        const version = await fetchLatestVersion(name);
        results.set(name, version);
      } catch (error) {
        console.error(
          `Failed to fetch version for "${name}":`,
          error instanceof Error ? error.message : error
        );
        results.set(name, null);
      }
    })
  );

  await Promise.all(tasks);

  return results;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Encode a package name for use in a URL path.
 * Scoped packages like `@tanstack/react-query` become `%40tanstack%2Freact-query`.
 */
function encodePackageName(name: string): string {
  return encodeURIComponent(name);
}
