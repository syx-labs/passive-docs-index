#!/usr/bin/env bun
/**
 * Per-Module Coverage Enforcement
 *
 * Parses coverage/lcov.info and enforces per-module coverage thresholds.
 * Exits with code 1 if any module is below threshold.
 *
 * Note: Bun does NOT support branch coverage (GitHub #7100) or per-module
 * thresholds (GitHub #5099). This script fills both gaps.
 *
 * Usage: bun run scripts/check-coverage.ts
 */

const THRESHOLD = 0.8; // 80%

interface ModuleEntry {
  name: string;
  path: string;
}

const MODULES: ModuleEntry[] = [
  // src/lib/ modules
  { name: "config", path: "src/lib/config.ts" },
  { name: "constants", path: "src/lib/constants.ts" },
  { name: "context7", path: "src/lib/context7.ts" },
  { name: "context7-client", path: "src/lib/context7-client.ts" },
  { name: "error-handler", path: "src/lib/error-handler.ts" },
  { name: "errors", path: "src/lib/errors.ts" },
  { name: "freshness", path: "src/lib/freshness.ts" },
  { name: "fs-utils", path: "src/lib/fs-utils.ts" },
  { name: "index-parser", path: "src/lib/index-parser.ts" },
  { name: "index-utils", path: "src/lib/index-utils.ts" },
  { name: "mcp-client", path: "src/lib/mcp-client.ts" },
  { name: "postinstall", path: "src/lib/postinstall.ts" },
  { name: "registry-client", path: "src/lib/registry-client.ts" },
  { name: "templates", path: "src/lib/templates.ts" },
];

// ============================================================================
// LCOV Parser
// ============================================================================

interface FileCoverage {
  file: string;
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
}

function parseLcov(content: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let current: Partial<FileCoverage> = {};

  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) {
      current = { file: line.slice(3) };
    } else if (line.startsWith("LF:")) {
      current.linesFound = Number.parseInt(line.slice(3), 10);
    } else if (line.startsWith("LH:")) {
      current.linesHit = Number.parseInt(line.slice(3), 10);
    } else if (line.startsWith("FNF:")) {
      current.functionsFound = Number.parseInt(line.slice(4), 10);
    } else if (line.startsWith("FNH:")) {
      current.functionsHit = Number.parseInt(line.slice(4), 10);
    } else if (line === "end_of_record") {
      if (
        current.file &&
        current.linesFound !== undefined &&
        current.linesHit !== undefined
      ) {
        current.functionsFound ??= 0;
        current.functionsHit ??= 0;
        files.push(current as FileCoverage);
      }
      current = {};
    }
  }

  return files;
}

// ============================================================================
// Main
// ============================================================================

const lcovPath = "coverage/lcov.info";
let lcov: string;

try {
  lcov = await Bun.file(lcovPath).text();
} catch {
  console.error(
    `WARNING: ${lcovPath} not found. Run tests with coverage first.`
  );
  console.error("Skipping per-module coverage check.");
  process.exit(0);
}

if (lcov.trim().length === 0) {
  console.error(`WARNING: ${lcovPath} is empty. No coverage data available.`);
  console.error("Skipping per-module coverage check.");
  process.exit(0);
}

const fileCoverages = parseLcov(lcov);
let failed = false;
let checkedModules = 0;

console.log("Per-module coverage report:");
console.log("=".repeat(60));

for (const mod of MODULES) {
  // Match by normalized suffix (handles absolute paths from coverage tools)
  const normalizedModPath = mod.path.replace(/\\/g, "/").toLowerCase();
  const moduleFiles = fileCoverages.filter((f) => {
    const normalizedFile = f.file.replace(/\\/g, "/").toLowerCase();
    return (
      normalizedFile === normalizedModPath ||
      normalizedFile.endsWith(`/${normalizedModPath}`)
    );
  });

  if (moduleFiles.length === 0) {
    console.log(`  SKIP: ${mod.name} -- no coverage data`);
    continue;
  }

  checkedModules++;

  const totalLines = moduleFiles.reduce((s, f) => s + f.linesFound, 0);
  const hitLines = moduleFiles.reduce((s, f) => s + f.linesHit, 0);
  const lineCoverage = totalLines > 0 ? hitLines / totalLines : 0;

  const totalFns = moduleFiles.reduce((s, f) => s + f.functionsFound, 0);
  const hitFns = moduleFiles.reduce((s, f) => s + f.functionsHit, 0);
  const fnCoverage = totalFns > 0 ? hitFns / totalFns : 0;

  const status =
    lineCoverage >= THRESHOLD && fnCoverage >= THRESHOLD ? "PASS" : "FAIL";
  if (status === "FAIL") {
    failed = true;
  }

  console.log(
    `  ${status}: ${mod.name} -- lines: ${(lineCoverage * 100).toFixed(1)}%, functions: ${(fnCoverage * 100).toFixed(1)}%`
  );
}

console.log("=".repeat(60));

if (checkedModules === 0) {
  if (fileCoverages.length > 0) {
    console.error(
      `\nWARNING: LCOV has ${fileCoverages.length} file(s) but none matched MODULES. Check path configuration.`
    );
    console.error("LCOV files:");
    for (const f of fileCoverages.slice(0, 5)) {
      console.error(`  - ${f.file}`);
    }
    process.exit(1);
  }
  console.log(
    "\nNo modules had coverage data. This is expected before tests are written."
  );
  process.exit(0);
}

if (failed) {
  console.error(
    `\nCoverage below ${THRESHOLD * 100}% threshold for one or more modules.`
  );
  process.exit(1);
}

console.log(
  `\nAll ${checkedModules} checked module(s) meet ${THRESHOLD * 100}% coverage threshold.`
);
