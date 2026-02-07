/**
 * PDI Generate Command
 * Analyzes codebase and generates internal pattern documentation
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import {
  configExists,
  readConfig,
  updateSyncTime,
  writeConfig,
} from "../lib/config.js";
import {
  formatSize,
  readInternalDocs,
  writeInternalDocFile,
} from "../lib/fs-utils.js";
import { updateClaudeMdFromConfig } from "../lib/index-utils.js";

export interface GenerateOptions {
  category?: string;
  dryRun?: boolean;
  ai?: boolean;
  projectRoot?: string;
}

interface DetectedPattern {
  name: string;
  category: string;
  fileName: string;
  description: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string[];
  suggestedContent: string;
}

// ============================================================================
// Pattern Detection
// ============================================================================

const PATTERN_DETECTORS: Array<{
  name: string;
  category: string;
  fileName: string;
  detect: (
    files: FileInfo[],
    content: Map<string, string>
  ) => DetectedPattern | null;
}> = [
  {
    name: "Two-Schema Database Pattern",
    category: "database",
    fileName: "two-schema-pattern.mdx",
    detect: (files, content) => {
      const schemaFiles = files.filter(
        (f) =>
          f.path.includes("schema") &&
          (f.name.endsWith(".ts") || f.name.endsWith(".js"))
      );

      if (schemaFiles.length < 2) {
        return null;
      }

      // Look for Better Auth schema and custom schema
      const hasBetterAuthSchema = schemaFiles.some((f) => {
        const c = content.get(f.path);
        return c && (c.includes("better-auth") || c.includes("betterAuth"));
      });

      const hasCustomSchema = schemaFiles.some((f) => {
        const c = content.get(f.path);
        return (
          c &&
          !c.includes("better-auth") &&
          (c.includes("pgTable") ||
            c.includes("mysqlTable") ||
            c.includes("sqliteTable"))
        );
      });

      if (hasBetterAuthSchema && hasCustomSchema) {
        return {
          name: "Two-Schema Database Pattern",
          category: "database",
          fileName: "two-schema-pattern.mdx",
          description:
            "Separates auto-generated schemas (e.g., Better Auth) from application schemas",
          confidence: "HIGH",
          evidence: schemaFiles.map((f) => f.path),
          suggestedContent: generateTwoSchemaDoc(schemaFiles),
        };
      }

      return null;
    },
  },
  {
    name: "Feature Gating Pattern",
    category: "database",
    fileName: "feature-gating.mdx",
    detect: (files, content) => {
      const middlewareFiles = files.filter(
        (f) =>
          (f.path.includes("middleware") || f.path.includes("guard")) &&
          (f.name.endsWith(".ts") || f.name.endsWith(".js"))
      );

      for (const file of middlewareFiles) {
        const c = content.get(file.path);
        if (
          c &&
          (c.includes("requireFeature") ||
            c.includes("featureGate") ||
            c.includes("checkFeature"))
        ) {
          return {
            name: "Feature Gating Pattern",
            category: "database",
            fileName: "feature-gating.mdx",
            description:
              "Middleware pattern for gating features based on subscription/plan",
            confidence: "HIGH",
            evidence: [file.path],
            suggestedContent: generateFeatureGatingDoc(file.path, c),
          };
        }
      }

      return null;
    },
  },
  {
    name: "ESM Imports Convention",
    category: "conventions",
    fileName: "esm-imports.mdx",
    detect: (files, content) => {
      const tsFiles = files.filter(
        (f) => f.name.endsWith(".ts") && !f.name.endsWith(".d.ts")
      );

      let withJsExt = 0;
      let withoutJsExt = 0;

      for (const file of tsFiles.slice(0, 50)) {
        const c = content.get(file.path);
        if (!c) {
          continue;
        }

        // Count imports with and without .js extension
        const imports = c.match(/from\s+['"]\..*?['"]/g) || [];
        for (const imp of imports) {
          if (imp.includes(".js")) {
            withJsExt++;
          } else if (!imp.includes(".json")) {
            withoutJsExt++;
          }
        }
      }

      if (withJsExt > 10 && withJsExt > withoutJsExt * 2) {
        return {
          name: "ESM Imports with .js Extension",
          category: "conventions",
          fileName: "esm-imports.mdx",
          description:
            "TypeScript imports use .js extension for ESM compatibility",
          confidence: "HIGH",
          evidence: [`${withJsExt} imports with .js extension found`],
          suggestedContent: generateEsmImportsDoc(),
        };
      }

      return null;
    },
  },
  {
    name: "Path Aliases Convention",
    category: "conventions",
    fileName: "path-aliases.mdx",
    detect: (files, content) => {
      // Check tsconfig.json for path aliases
      const tsconfigFile = files.find(
        (f) => f.name === "tsconfig.json" && !f.path.includes("node_modules")
      );

      if (!tsconfigFile) {
        return null;
      }

      const c = content.get(tsconfigFile.path);
      if (!c) {
        return null;
      }

      try {
        const tsconfig = JSON.parse(c);
        const paths = tsconfig.compilerOptions?.paths;

        if (paths && Object.keys(paths).length > 0) {
          return {
            name: "Path Aliases Convention",
            category: "conventions",
            fileName: "path-aliases.mdx",
            description: "TypeScript path aliases for cleaner imports",
            confidence: "HIGH",
            evidence: Object.keys(paths).map((p) => `${p} -> ${paths[p]}`),
            suggestedContent: generatePathAliasesDoc(paths),
          };
        }
      } catch (_error) {
        // Invalid tsconfig JSON — skip path alias detection
      }

      return null;
    },
  },
  {
    name: "Add Route Workflow",
    category: "workflows",
    fileName: "add-route.mdx",
    detect: (files, content) => {
      // Look for Hono or Express route patterns
      const routeFiles = files.filter(
        (f) =>
          (f.path.includes("route") || f.path.includes("api")) &&
          (f.name.endsWith(".ts") || f.name.endsWith(".js"))
      );

      const hasHono = routeFiles.some((f) => {
        const c = content.get(f.path);
        return c && (c.includes("Hono") || c.includes("hono"));
      });

      const hasExpress = routeFiles.some((f) => {
        const c = content.get(f.path);
        return c?.includes("express");
      });

      if (hasHono || hasExpress) {
        const framework = hasHono ? "Hono" : "Express";
        return {
          name: "Add Route Workflow",
          category: "workflows",
          fileName: "add-route.mdx",
          description: `Steps to add a new API route using ${framework}`,
          confidence: "MEDIUM",
          evidence: routeFiles.slice(0, 3).map((f) => f.path),
          suggestedContent: generateAddRouteDoc(framework, routeFiles),
        };
      }

      return null;
    },
  },
];

// ============================================================================
// File Scanning
// ============================================================================

interface FileInfo {
  path: string;
  name: string;
  size: number;
}

async function scanProjectFiles(projectRoot: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const ignoreDirs = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    ".claude-docs",
    ".next",
    ".nuxt",
    "coverage",
  ]);

  async function scan(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      console.error(
        "Failed to scan directory:",
        dir,
        error instanceof Error ? error.message : String(error)
      );
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!(ignoreDirs.has(entry.name) || entry.name.startsWith("."))) {
          await scan(fullPath);
        }
      } else {
        const ext = extname(entry.name);
        if ([".ts", ".tsx", ".js", ".jsx", ".json"].includes(ext)) {
          try {
            const fileStat = await stat(fullPath);
            files.push({
              path: relative(projectRoot, fullPath),
              name: entry.name,
              size: fileStat.size,
            });
          } catch (_error) {
            // Skip inaccessible files (permission denied, broken symlinks, etc.)
          }
        }
      }
    }
  }

  await scan(projectRoot);
  return files;
}

async function readFileContents(
  projectRoot: string,
  files: FileInfo[]
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();

  // Only read files smaller than 100KB
  const filesToRead = files.filter((f) => f.size < 100 * 1024);

  for (const file of filesToRead.slice(0, 200)) {
    try {
      const content = await readFile(join(projectRoot, file.path), "utf-8");
      contents.set(file.path, content);
    } catch (_error) {
      // Skip files that can't be read (encoding issues, permissions, etc.)
    }
  }

  return contents;
}

// ============================================================================
// Document Generators
// ============================================================================

function generateTwoSchemaDoc(schemaFiles: FileInfo[]): string {
  return `---
# Part of Passive Docs Index - Internal Patterns
# Category: database
# Last updated: ${new Date().toISOString().split("T")[0]}
---

# Two-Schema Database Pattern

This project separates database schemas into two files to maintain clean boundaries.

## Schema Files

${schemaFiles.map((f) => `- \`${f.path}\``).join("\n")}

## Pattern

1. **Auto-generated Schema** (e.g., \`schema.ts\`)
   - Contains tables managed by external libraries (Better Auth, etc.)
   - **NEVER edit manually** - changes will be overwritten
   - Re-generated by running the library's schema generation command

2. **Application Schema** (e.g., \`custom-schema.ts\`)
   - Contains all application-specific tables
   - Safe to edit and extend
   - Import types from here for application code

## Usage

\`\`\`typescript
// Import from application schema for type safety
import { users, posts } from '@/db/custom-schema.js';

// Both schemas are combined in the database instance
import { db } from '@/db/database.js';
\`\`\`

## Why This Pattern?

- Prevents accidental edits to auto-generated code
- Clear ownership boundaries
- Easier upgrades of external libraries
`;
}

function generateFeatureGatingDoc(filePath: string, _content: string): string {
  return `---
# Part of Passive Docs Index - Internal Patterns
# Category: database
# Last updated: ${new Date().toISOString().split("T")[0]}
---

# Feature Gating Pattern

Middleware pattern for controlling access to features based on subscription plans.

## Location

\`${filePath}\`

## Usage

\`\`\`typescript
// In route definition
app.post('/api/resource',
  requireAuth,
  requireFeature({
    resourceType: 'platform',
    featureKey: 'premium_feature',
    action: 'consume', // or 'read', 'write'
  }),
  handler
);
\`\`\`

## Parameters

- \`resourceType\`: The category of resource being accessed
- \`featureKey\`: The specific feature being gated
- \`action\`: The type of access being requested

## How It Works

1. Middleware checks user's subscription/plan
2. Looks up feature limits for the plan
3. For 'consume' actions, checks usage against limits
4. Returns 403 if access is denied
`;
}

function generateEsmImportsDoc(): string {
  return `---
# Part of Passive Docs Index - Internal Patterns
# Category: conventions
# Last updated: ${new Date().toISOString().split("T")[0]}
---

# ESM Imports Convention

This project uses ESM (ECMAScript Modules) with explicit \`.js\` extensions in imports.

## Rule

Always include the \`.js\` extension when importing local TypeScript files:

\`\`\`typescript
// ✅ Correct
import { db } from '@/db/database.js';
import { User } from './types.js';

// ❌ Wrong
import { db } from '@/db/database';
import { User } from './types';
\`\`\`

## Why?

1. **ESM Compliance**: Node.js ESM requires explicit file extensions
2. **Runtime Compatibility**: TypeScript compiles \`.ts\` to \`.js\`, so imports must match
3. **Bundler Agnostic**: Works with any bundler or runtime

## Exceptions

- External packages: \`import { z } from 'zod';\` (no extension)
- JSON files: \`import config from './config.json';\` (use \`.json\`)
- Type-only imports can omit extension if using \`verbatimModuleSyntax\`
`;
}

function generatePathAliasesDoc(paths: Record<string, string[]>): string {
  const aliasesDoc = Object.entries(paths)
    .map(([alias, targets]) => `- \`${alias}\` → \`${targets.join(", ")}\``)
    .join("\n");

  return `---
# Part of Passive Docs Index - Internal Patterns
# Category: conventions
# Last updated: ${new Date().toISOString().split("T")[0]}
---

# Path Aliases Convention

This project uses TypeScript path aliases for cleaner imports.

## Configured Aliases

${aliasesDoc}

## Usage

\`\`\`typescript
// Instead of relative paths
import { db } from '../../../db/database.js';

// Use path aliases
import { db } from '@/db/database.js';
\`\`\`

## Configuration

Aliases are defined in \`tsconfig.json\`:

\`\`\`json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
${Object.entries(paths)
  .map(([alias, targets]) => `      "${alias}": ${JSON.stringify(targets)}`)
  .join(",\n")}
    }
  }
}
\`\`\`

## Note

If using a bundler (Vite, esbuild), ensure it's configured to resolve these aliases.
`;
}

function generateAddRouteDoc(
  framework: string,
  routeFiles: FileInfo[]
): string {
  const examplePath = routeFiles[0]?.path || "src/routes/example.ts";

  if (framework === "Hono") {
    return `---
# Part of Passive Docs Index - Internal Patterns
# Category: workflows
# Last updated: ${new Date().toISOString().split("T")[0]}
---

# Add Route Workflow (Hono)

Steps to add a new API route to the application.

## Example Route Location

\`${examplePath}\`

## Steps

### 1. Create the Route File

\`\`\`typescript
// src/routes/my-feature.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

const createSchema = z.object({
  name: z.string().min(1),
});

app.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json');
  // Implementation
  return c.json({ success: true, data });
});

app.get('/:id', async (c) => {
  const id = c.req.param('id');
  // Implementation
  return c.json({ id });
});

export default app;
\`\`\`

### 2. Register the Route

In your main app file:

\`\`\`typescript
import myFeature from './routes/my-feature.js';

app.route('/api/my-feature', myFeature);
\`\`\`

### 3. Add Middleware (if needed)

\`\`\`typescript
app.use('/api/my-feature/*', requireAuth);
\`\`\`

## Checklist

- [ ] Create route file with proper validation
- [ ] Register route in main app
- [ ] Add authentication middleware if needed
- [ ] Add feature gating if needed
- [ ] Write tests
`;
  }

  // Express version
  return `---
# Part of Passive Docs Index - Internal Patterns
# Category: workflows
# Last updated: ${new Date().toISOString().split("T")[0]}
---

# Add Route Workflow (Express)

Steps to add a new API route to the application.

## Example Route Location

\`${examplePath}\`

## Steps

### 1. Create the Route File

\`\`\`typescript
// src/routes/my-feature.ts
import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  const data = req.body;
  // Implementation
  res.json({ success: true, data });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  // Implementation
  res.json({ id });
});

export default router;
\`\`\`

### 2. Register the Route

\`\`\`typescript
import myFeature from './routes/my-feature.js';

app.use('/api/my-feature', myFeature);
\`\`\`

## Checklist

- [ ] Create route file with proper validation
- [ ] Register route in main app
- [ ] Add authentication middleware if needed
- [ ] Write tests
`;
}

// ============================================================================
// Main Command
// ============================================================================

export async function generateCommand(
  type: string,
  options: GenerateOptions
): Promise<void> {
  const projectRoot = options.projectRoot || process.cwd();
  const spinner = ora();

  if (type !== "internal") {
    throw new Error(`Unknown type: ${type}. Available: internal`);
  }

  // Check if initialized
  if (!configExists(projectRoot)) {
    throw new Error("PDI not initialized. Run: pdi init");
  }

  // Read config
  let config = await readConfig(projectRoot);
  if (!config) {
    throw new Error("Failed to read config");
  }

  console.log(chalk.bold("Analyzing codebase...\n"));

  // Scan project files
  spinner.start("Scanning project files...");
  const files = await scanProjectFiles(projectRoot);
  spinner.succeed(`Found ${files.length} source files`);

  // Read file contents
  spinner.start("Reading file contents...");
  const contents = await readFileContents(projectRoot, files);
  spinner.succeed(`Read ${contents.size} files`);

  // Detect patterns
  spinner.start("Detecting patterns...");
  const detectedPatterns: DetectedPattern[] = [];

  for (const detector of PATTERN_DETECTORS) {
    if (options.category && detector.category !== options.category) {
      continue;
    }

    const pattern = detector.detect(files, contents);
    if (pattern) {
      detectedPatterns.push(pattern);
    }
  }

  spinner.succeed(`Detected ${detectedPatterns.length} patterns`);

  if (detectedPatterns.length === 0) {
    console.log(chalk.yellow("\nNo patterns detected."));
    console.log(chalk.dim("This could mean:"));
    console.log(chalk.dim("  - The codebase is too small"));
    console.log(chalk.dim("  - Patterns use non-standard conventions"));
    console.log(
      chalk.dim("  - Add patterns manually to .claude-docs/internal/")
    );
    return;
  }

  // Display detected patterns
  console.log(chalk.bold("\nDetected patterns:"));

  for (let i = 0; i < detectedPatterns.length; i++) {
    const p = detectedPatterns[i];
    const confColor =
      p.confidence === "HIGH"
        ? chalk.green
        : p.confidence === "MEDIUM"
          ? chalk.yellow
          : chalk.dim;

    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     ${chalk.dim(p.description)}`);
    console.log(`     Confidence: ${confColor(p.confidence)}`);

    if (p.evidence.length > 0) {
      console.log(
        `     Evidence: ${chalk.dim(p.evidence.slice(0, 2).join(", "))}`
      );
    }
  }

  // Dry run - just show what would be generated
  if (options.dryRun) {
    console.log(chalk.yellow("\n[Dry run] Would generate:"));
    for (const p of detectedPatterns) {
      console.log(`  - .claude-docs/internal/${p.category}/${p.fileName}`);
    }
    return;
  }

  // Confirm generation
  const response = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Generate documentation for ${detectedPatterns.length} pattern(s)?`,
    initial: true,
  });

  if (!response.confirm) {
    console.log(chalk.dim("Cancelled."));
    return;
  }

  // Generate documentation
  console.log("");
  let generatedCount = 0;

  for (const pattern of detectedPatterns) {
    spinner.start(`Creating ${pattern.category}/${pattern.fileName}...`);

    await writeInternalDocFile(
      projectRoot,
      pattern.category,
      pattern.fileName,
      pattern.suggestedContent
    );

    const size = Buffer.byteLength(pattern.suggestedContent, "utf-8");
    spinner.succeed(
      `${chalk.green("✓")} .claude-docs/internal/${pattern.category}/${pattern.fileName} (${formatSize(size)})`
    );
    generatedCount++;
  }

  // Update config based on actual internal docs on disk (not just this run)
  const internalDocs = await readInternalDocs(projectRoot);
  const internalCategories = Object.keys(internalDocs);
  const totalInternalFiles = Object.values(internalDocs).reduce(
    (sum, docs) => sum + docs.length,
    0
  );
  config.internal = {
    enabled: totalInternalFiles > 0,
    categories: internalCategories,
    totalFiles: totalInternalFiles,
  };
  config = updateSyncTime(config);
  await writeConfig(projectRoot, config);

  // Update index in CLAUDE.md
  spinner.start("Updating index in CLAUDE.md...");

  const indexResult = await updateClaudeMdFromConfig({ projectRoot, config });

  spinner.succeed(
    `Updated index in CLAUDE.md (${indexResult.indexSize.toFixed(2)}KB)`
  );

  console.log("");
  console.log(chalk.green(`✓ Generated ${generatedCount} internal doc(s)`));
}
