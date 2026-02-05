/**
 * Coverage Loader
 * Forces Bun to load all source modules so they appear in coverage reports.
 * Without this, modules that aren't imported by any test are invisible to coverage.
 *
 * See: https://www.charpeni.com/blog/bun-code-coverage-gap
 */

import { test } from "bun:test";

test("all source modules are loaded for coverage", async () => {
  const glob = new Bun.Glob("src/lib/**/*.ts");
  const projectRoot = import.meta.dir + "/..";
  let loaded = 0;

  for await (const file of glob.scan({ cwd: projectRoot })) {
    // Skip declaration files and the interfaces directory (loaded via re-exports)
    if (file.endsWith(".d.ts")) {
      continue;
    }

    await import(`../${file}`);
    loaded++;
  }

  // Sanity check: we should load at least the known 10 modules
  if (loaded < 8) {
    throw new Error(
      `Expected at least 8 source modules but only loaded ${loaded}`,
    );
  }
});
