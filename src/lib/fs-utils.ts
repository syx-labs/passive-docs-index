/**
 * File System Utilities
 * Helper functions for file operations
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { DocFile } from './types.js';
import { CLAUDE_DOCS_DIR, FRAMEWORKS_DIR, INTERNAL_DIR } from './constants.js';

// ============================================================================
// Directory Operations
// ============================================================================

export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

export async function removeDir(dirPath: string): Promise<void> {
  if (existsSync(dirPath)) {
    await rm(dirPath, { recursive: true, force: true });
  }
}

export async function listDir(dirPath: string): Promise<string[]> {
  if (!existsSync(dirPath)) {
    return [];
  }
  return await readdir(dirPath);
}

export async function listDirRecursive(dirPath: string): Promise<string[]> {
  if (!existsSync(dirPath)) {
    return [];
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await listDirRecursive(fullPath);
      files.push(...nested);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

// ============================================================================
// File Operations
// ============================================================================

export async function writeDocFile(
  projectRoot: string,
  framework: string,
  category: string,
  fileName: string,
  content: string
): Promise<string> {
  const filePath = join(
    projectRoot,
    CLAUDE_DOCS_DIR,
    FRAMEWORKS_DIR,
    framework,
    category,
    fileName
  );

  await ensureDir(join(projectRoot, CLAUDE_DOCS_DIR, FRAMEWORKS_DIR, framework, category));
  await writeFile(filePath, content, 'utf-8');

  return filePath;
}

export async function writeInternalDocFile(
  projectRoot: string,
  category: string,
  fileName: string,
  content: string
): Promise<string> {
  const filePath = join(
    projectRoot,
    CLAUDE_DOCS_DIR,
    INTERNAL_DIR,
    category,
    fileName
  );

  await ensureDir(join(projectRoot, CLAUDE_DOCS_DIR, INTERNAL_DIR, category));
  await writeFile(filePath, content, 'utf-8');

  return filePath;
}

export async function readDocFile(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  return await readFile(filePath, 'utf-8');
}

// ============================================================================
// Docs Structure Reading
// ============================================================================

export async function readFrameworkDocs(
  projectRoot: string,
  frameworkName: string
): Promise<Record<string, DocFile[]>> {
  const frameworkPath = join(projectRoot, CLAUDE_DOCS_DIR, FRAMEWORKS_DIR, frameworkName);

  if (!existsSync(frameworkPath)) {
    return {};
  }

  const result: Record<string, DocFile[]> = {};
  const categories = await listDir(frameworkPath);

  for (const category of categories) {
    const categoryPath = join(frameworkPath, category);
    const categoryStat = await stat(categoryPath);

    if (!categoryStat.isDirectory()) continue;

    const files = await listDir(categoryPath);
    result[category] = [];

    for (const fileName of files) {
      if (!fileName.endsWith('.mdx')) continue;

      const filePath = join(categoryPath, fileName);
      const content = await readFile(filePath, 'utf-8');
      const fileStat = await stat(filePath);

      result[category].push({
        path: filePath,
        framework: frameworkName,
        category,
        name: fileName,
        content,
        sizeBytes: fileStat.size,
      });
    }
  }

  return result;
}

export async function readAllFrameworkDocs(
  projectRoot: string
): Promise<Record<string, Record<string, DocFile[]>>> {
  const frameworksPath = join(projectRoot, CLAUDE_DOCS_DIR, FRAMEWORKS_DIR);

  if (!existsSync(frameworksPath)) {
    return {};
  }

  const result: Record<string, Record<string, DocFile[]>> = {};
  const frameworks = await listDir(frameworksPath);

  for (const framework of frameworks) {
    const frameworkPath = join(frameworksPath, framework);
    const frameworkStat = await stat(frameworkPath);

    if (!frameworkStat.isDirectory()) continue;

    result[framework] = await readFrameworkDocs(projectRoot, framework);
  }

  return result;
}

export async function readInternalDocs(
  projectRoot: string
): Promise<Record<string, DocFile[]>> {
  const internalPath = join(projectRoot, CLAUDE_DOCS_DIR, INTERNAL_DIR);

  if (!existsSync(internalPath)) {
    return {};
  }

  const result: Record<string, DocFile[]> = {};
  const categories = await listDir(internalPath);

  for (const category of categories) {
    const categoryPath = join(internalPath, category);
    const categoryStat = await stat(categoryPath);

    if (!categoryStat.isDirectory()) continue;

    const files = await listDir(categoryPath);
    result[category] = [];

    for (const fileName of files) {
      if (!fileName.endsWith('.mdx')) continue;

      const filePath = join(categoryPath, fileName);
      const content = await readFile(filePath, 'utf-8');
      const fileStat = await stat(filePath);

      result[category].push({
        path: filePath,
        framework: 'internal',
        category,
        name: fileName,
        content,
        sizeBytes: fileStat.size,
      });
    }
  }

  return result;
}

// ============================================================================
// Size Calculations
// ============================================================================

export async function calculateDocsSize(projectRoot: string): Promise<{
  frameworks: Record<string, number>;
  internal: number;
  total: number;
}> {
  const docsPath = join(projectRoot, CLAUDE_DOCS_DIR);

  if (!existsSync(docsPath)) {
    return { frameworks: {}, internal: 0, total: 0 };
  }

  const allFiles = await listDirRecursive(docsPath);
  const frameworks: Record<string, number> = {};
  let internal = 0;
  let total = 0;

  for (const filePath of allFiles) {
    if (!filePath.endsWith('.mdx')) continue;

    const fileStat = await stat(filePath);
    const relativePath = relative(docsPath, filePath);
    const parts = relativePath.split('/');

    total += fileStat.size;

    if (parts[0] === FRAMEWORKS_DIR && parts.length >= 2) {
      const framework = parts[1];
      frameworks[framework] = (frameworks[framework] || 0) + fileStat.size;
    } else if (parts[0] === INTERNAL_DIR) {
      internal += fileStat.size;
    }
  }

  return { frameworks, internal, total };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)}KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)}MB`;
}

// ============================================================================
// Gitignore
// ============================================================================

export async function updateGitignore(projectRoot: string): Promise<boolean> {
  const gitignorePath = join(projectRoot, '.gitignore');
  const entry = '\n# PDI temp files\n.claude-docs/.cache/\n';

  if (!existsSync(gitignorePath)) {
    await writeFile(gitignorePath, entry.trim() + '\n', 'utf-8');
    return true;
  }

  const content = await readFile(gitignorePath, 'utf-8');

  if (content.includes('.claude-docs/.cache/')) {
    return false;
  }

  await writeFile(gitignorePath, content.trimEnd() + entry, 'utf-8');
  return true;
}
