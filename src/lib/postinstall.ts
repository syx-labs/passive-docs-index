/**
 * PDI Postinstall Hook
 * Lightweight script that checks for PDI config and reports staleness to stderr.
 *
 * Rules:
 * - ALL output goes to process.stderr.write() (npm 7+ suppresses dependency stdout)
 * - Uses ANSI escape codes directly (NOT chalk) for minimal import overhead
 * - NEVER exits non-zero (would break npm install)
 * - Entire execution wrapped in try-catch that silently exits 0
 * - Dynamic imports to lazy-load heavy modules only if needed
 */

const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";

export async function runPostinstall(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const { configExists } = await import("./config.js");

    if (!configExists(projectRoot)) {
      process.stderr.write(
        `\n${CYAN}[pdi]${RESET} Run \`npx pdi init\` to set up documentation indexing\n\n`
      );
      return;
    }

    const { readConfig, readPackageJson } = await import("./config.js");
    const { checkFreshness } = await import("./freshness.js");

    const config = await readConfig(projectRoot);
    if (!config) {
      return;
    }

    const packageJson = await readPackageJson(projectRoot);

    try {
      const result = await checkFreshness(config, packageJson);

      if (result.exitCode === 0) {
        process.stderr.write(
          `\n${GREEN}[pdi]${RESET} All documentation is up-to-date\n\n`
        );
        return;
      }

      const staleItems = result.results
        .filter((r) => r.status === "stale")
        .map(
          (r) =>
            `${r.framework} (v${r.indexedVersion}\u2192v${r.latestVersion ?? "?"})`
        );

      const orphanedItems = result.results
        .filter((r) => r.status === "orphaned")
        .map((r) => r.framework);

      const missingItems = result.results
        .filter((r) => r.status === "missing")
        .map((r) => r.framework);

      let message = `\n${YELLOW}[pdi]${RESET} Doc issues detected:\n`;

      if (staleItems.length > 0) {
        message += `${DIM}  Stale: ${staleItems.join(", ")}${RESET}\n`;
      }
      if (orphanedItems.length > 0) {
        message += `${DIM}  Orphaned: ${orphanedItems.join(", ")}${RESET}\n`;
      }
      if (missingItems.length > 0) {
        message += `${DIM}  Missing: ${missingItems.join(", ")}${RESET}\n`;
      }

      message += `${DIM}  Run \`npx pdi sync\` to update${RESET}\n\n`;
      process.stderr.write(message);
    } catch (error) {
      // Network/registry errors — non-fatal, but log for debuggability
      if (process.env.PDI_DEBUG) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `${DIM}[pdi] Freshness check skipped: ${msg}${RESET}\n`
        );
      }
    }
  } catch (error) {
    // NEVER exit non-zero (would break npm install), but log for debuggability
    if (process.env.PDI_DEBUG) {
      const msg = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `${DIM}[pdi] Postinstall check failed: ${msg}${RESET}\n`
      );
    }
  }
}

// Only run when executed directly, not when imported by tests
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPostinstall();
}
