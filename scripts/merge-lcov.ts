#!/usr/bin/env bun
/**
 * Merge multiple LCOV reports into one.
 *
 * Bun overwrites coverage/lcov.info on every process. When tests must run in
 * isolated processes (mock.module leaks), keep the best per-file record across
 * suite reports before enforcing thresholds.
 *
 * Bun's LCOV often omits FN/FNDA detail and only emits FNF/FNH + DA lines, so
 * we preserve whole SF records rather than reconstructing function tables.
 *
 * Usage: bun run scripts/merge-lcov.ts <out.lcov> <in1.lcov> [in2.lcov ...]
 */

interface FileRecord {
  sf: string;
  body: string; // full record from TN:/SF: through end_of_record
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
}

function parseRecords(content: string): FileRecord[] {
  const records: FileRecord[] = [];
  let sf = "";
  let chunk: string[] = [];
  let linesFound = 0;
  let linesHit = 0;
  let functionsFound = 0;
  let functionsHit = 0;

  const reset = () => {
    sf = "";
    chunk = [];
    linesFound = 0;
    linesHit = 0;
    functionsFound = 0;
    functionsHit = 0;
  };

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();

    if (line.startsWith("SF:")) {
      sf = line.slice(3);
      chunk = ["TN:", line];
      linesFound = 0;
      linesHit = 0;
      functionsFound = 0;
      functionsHit = 0;
      continue;
    }

    if (!sf) {
      continue;
    }

    chunk.push(line);

    if (line.startsWith("LF:")) {
      linesFound = Number.parseInt(line.slice(3), 10);
    } else if (line.startsWith("LH:")) {
      linesHit = Number.parseInt(line.slice(3), 10);
    } else if (line.startsWith("FNF:")) {
      functionsFound = Number.parseInt(line.slice(4), 10);
    } else if (line.startsWith("FNH:")) {
      functionsHit = Number.parseInt(line.slice(4), 10);
    } else if (line === "end_of_record") {
      records.push({
        sf,
        body: `${chunk.join("\n")}\n`,
        linesFound,
        linesHit,
        functionsFound,
        functionsHit,
      });
      reset();
    }
  }

  return records;
}

function score(record: FileRecord): number {
  const lineRatio =
    record.linesFound > 0 ? record.linesHit / record.linesFound : 0;
  const fnRatio =
    record.functionsFound > 0 ? record.functionsHit / record.functionsFound : 0;
  // Prefer higher line coverage, then function coverage, then more hit lines
  return lineRatio * 1_000_000 + fnRatio * 1000 + record.linesHit;
}

function mergeBest(inputs: FileRecord[][]): FileRecord[] {
  const byPath = new Map<string, FileRecord>();

  for (const records of inputs) {
    for (const record of records) {
      const key = record.sf.replace(/\\/g, "/");
      const existing = byPath.get(key);
      if (!existing || score(record) > score(existing)) {
        byPath.set(key, record);
      }
    }
  }

  return [...byPath.values()].sort((a, b) => a.sf.localeCompare(b.sf));
}

const [, , outPath, ...inPaths] = process.argv;

if (!outPath || inPaths.length === 0) {
  console.error(
    "Usage: bun run scripts/merge-lcov.ts <out.lcov> <in1.lcov> [in2.lcov ...]"
  );
  process.exit(2);
}

const parsed: FileRecord[][] = [];
for (const path of inPaths) {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.error(`Missing LCOV input: ${path}`);
    process.exit(1);
  }
  parsed.push(parseRecords(await file.text()));
}

const merged = mergeBest(parsed);
await Bun.write(outPath, merged.map((r) => r.body).join(""));
console.log(
  `Merged ${inPaths.length} LCOV report(s) → ${outPath} (${merged.length} files, best-per-file)`
);
