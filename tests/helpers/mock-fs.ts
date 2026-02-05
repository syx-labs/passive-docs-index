/**
 * Filesystem Mock Helpers
 * Provides utilities for creating mock filesystem state.
 *
 * IMPORTANT: mock.module() MUST be called BEFORE importing the modules
 * that depend on the mocked module. Use dynamic import() inside test
 * functions after setting up mocks.
 *
 * @example
 * ```ts
 * import { mock } from "bun:test";
 * import { createMockFs } from "./mock-fs.js";
 *
 * const { files, fsMock, fsPromisesMock } = createMockFs({
 *   "/project/package.json": '{"name": "test"}',
 *   "/project/.claude-docs/config.json": '{"version": "1.0.0"}',
 * });
 *
 * mock.module("node:fs", () => fsMock);
 * mock.module("node:fs/promises", () => fsPromisesMock);
 *
 * // Now dynamically import the module under test
 * const { readConfig } = await import("../../src/lib/config.js");
 * ```
 */

import { mock } from "bun:test";

export interface MockFsResult {
  /** The underlying file map -- mutate this in tests to change state */
  files: Map<string, string>;
  /** Mock implementations for node:fs (sync APIs) */
  fsMock: {
    existsSync: ReturnType<typeof mock>;
  };
  /** Mock implementations for node:fs/promises (async APIs) */
  fsPromisesMock: {
    readFile: ReturnType<typeof mock>;
    writeFile: ReturnType<typeof mock>;
    mkdir: ReturnType<typeof mock>;
    readdir: ReturnType<typeof mock>;
    rm: ReturnType<typeof mock>;
    stat: ReturnType<typeof mock>;
  };
}

/**
 * Create a mock filesystem backed by a Map<string, string>.
 *
 * @param initialFiles - Initial file contents keyed by absolute path
 * @returns Mock implementations for node:fs and node:fs/promises
 */
export function createMockFs(
  initialFiles: Record<string, string> = {},
): MockFsResult {
  const files = new Map<string, string>(Object.entries(initialFiles));

  const fsMock = {
    existsSync: mock((path: string) => {
      // Check if it's an exact file
      if (files.has(path)) return true;
      // Check if it's a directory (has children under this path)
      const prefix = path.endsWith("/") ? path : `${path}/`;
      for (const filePath of files.keys()) {
        if (filePath.startsWith(prefix)) {
          return true;
        }
      }
      return false;
    }),
  };

  const fsPromisesMock = {
    readFile: mock(async (path: string) => {
      const content = files.get(path);
      if (content === undefined) {
        const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
        (err as NodeJS.ErrnoException).code = "ENOENT";
        throw err;
      }
      return content;
    }),

    writeFile: mock(async (path: string, content: string) => {
      files.set(path, content);
    }),

    mkdir: mock(async (_path: string, _options?: { recursive?: boolean }) => {
      // No-op in mock -- directories are implicit
    }),

    readdir: mock(
      async (
        dirPath: string,
        options?: { withFileTypes?: boolean },
      ): Promise<string[] | Array<{ name: string; isDirectory: () => boolean }>> => {
        const entries: string[] = [];
        const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;

        for (const filePath of files.keys()) {
          if (filePath.startsWith(prefix)) {
            const relative = filePath.slice(prefix.length);
            const firstSegment = relative.split("/")[0];
            if (!entries.includes(firstSegment)) {
              entries.push(firstSegment);
            }
          }
        }

        if (options?.withFileTypes) {
          return entries.map((name) => ({
            name,
            isDirectory: () => {
              // It's a directory if there are files with it as a prefix
              const subPrefix = `${prefix}${name}/`;
              for (const filePath of files.keys()) {
                if (filePath.startsWith(subPrefix)) {
                  return true;
                }
              }
              return false;
            },
          }));
        }

        return entries;
      },
    ),

    rm: mock(async (path: string, _options?: { recursive?: boolean; force?: boolean }) => {
      // Remove the path and all children
      const prefix = path.endsWith("/") ? path : `${path}/`;
      for (const filePath of [...files.keys()]) {
        if (filePath === path || filePath.startsWith(prefix)) {
          files.delete(filePath);
        }
      }
    }),

    stat: mock(async (path: string) => {
      if (!files.has(path)) {
        // Check if it's a directory (has children)
        const prefix = path.endsWith("/") ? path : `${path}/`;
        let isDir = false;
        for (const filePath of files.keys()) {
          if (filePath.startsWith(prefix)) {
            isDir = true;
            break;
          }
        }
        if (!isDir) {
          const err = new Error(`ENOENT: no such file or directory, stat '${path}'`);
          (err as NodeJS.ErrnoException).code = "ENOENT";
          throw err;
        }
        return {
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
        };
      }
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: Buffer.byteLength(files.get(path)!, "utf-8"),
      };
    }),
  };

  return { files, fsMock, fsPromisesMock };
}
