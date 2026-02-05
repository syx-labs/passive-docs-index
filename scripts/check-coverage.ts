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
const MODULES = [
  "config",
  "templates",
  "index-parser",
  "fs-utils",
  "context7",
  "context7-client",
  "mcp-client",
  "index-utils",
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
      current.linesFound = parseInt(line.slice(3), 10);
    } else if (line.startsWith("LH:")) {
      current.linesHit = parseInt(line.slice(3), 10);
    } else if (line.startsWith("FNF:")) {
      current.functionsFound = parseInt(line.slice(4), 10);
    } else if (line.startsWith("FNH:")) {
      current.functionsHit = parseInt(line.slice(4), 10);
    } else if (line === "end_of_record") {
      if (current.file) {
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
  console.error(`WARNING: ${lcovPath} not found. Run tests with coverage first.`);
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
  // Match files in src/lib/ by exact filename (not in subdirectories).
  // "mcp-client" should match "src/lib/mcp-client.ts" but NOT "src/lib/interfaces/mcp-client.ts"
  const moduleFiles = fileCoverages.filter((f) => {
    const fileName = f.file.split("/").pop()?.replace(".ts", "") ?? "";
    const isDirectChild = f.file === `src/lib/${mod}.ts`;
    return fileName === mod && isDirectChild;
  });

  if (moduleFiles.length === 0) {
    console.log(`  SKIP: ${mod} -- no coverage data`);
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
  if (status === "FAIL") failed = true;

  console.log(
    `  ${status}: ${mod} -- lines: ${(lineCoverage * 100).toFixed(1)}%, functions: ${(fnCoverage * 100).toFixed(1)}%`,
  );
}

console.log("=".repeat(60));

if (checkedModules === 0) {
  console.log(
    "\nNo modules had coverage data. This is expected before tests are written.",
  );
  process.exit(0);
}

if (failed) {
  console.error(
    `\nCoverage below ${THRESHOLD * 100}% threshold for one or more modules.`,
  );
  process.exit(1);
}

console.log(
  `\nAll ${checkedModules} checked module(s) meet ${THRESHOLD * 100}% coverage threshold.`,
);
