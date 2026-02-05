/**
 * Unit Tests: mcp-client.ts subprocess functions
 *
 * Tests findInPath, findMcpCliInfo, isMcpCliAvailable, executeMcpCliCall,
 * queryContext7, resolveContext7Library, and queryContext7Batch by mocking
 * node:child_process, node:fs, and node:os.
 *
 * Strategy: Mock child_process with controllable spawn that creates
 * EventEmitter-based children. Each test creates fresh children via
 * the mockSpawnChild variable.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// Configurable mock state
// ---------------------------------------------------------------------------

let execSyncBehavior: "success" | "error" | "multi" = "error";
let execSyncResults: string[] = [];
let execSyncCallCount = 0;

let spawnChildren: Array<
  EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof mock>;
  }
> = [];
let spawnCallCount = 0;

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof mock>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = mock();
  return child;
}

function pushChild() {
  const child = createMockChild();
  spawnChildren.push(child);
  return child;
}

// ---------------------------------------------------------------------------
// Mock child_process
// ---------------------------------------------------------------------------

mock.module("node:child_process", () => ({
  execSync: mock((_cmd: string, _opts?: object) => {
    execSyncCallCount++;
    if (execSyncBehavior === "error") {
      throw new Error("not found");
    }
    if (execSyncBehavior === "multi") {
      const idx = execSyncCallCount - 1;
      if (idx < execSyncResults.length) {
        const val = execSyncResults[idx];
        if (val === "ERROR") throw new Error("not found");
        return val;
      }
      throw new Error("not found");
    }
    return execSyncResults[0] || "";
  }),
  spawn: mock((_cmd: string, _args: string[], _opts?: object) => {
    const idx = spawnCallCount++;
    if (idx < spawnChildren.length) {
      return spawnChildren[idx];
    }
    return createMockChild();
  }),
}));

// ---------------------------------------------------------------------------
// Mock filesystem
// ---------------------------------------------------------------------------

let existsSyncPaths = new Set<string>();
let readdirSyncResult: string[] = [];

mock.module("node:fs", () => ({
  existsSync: mock((path: string) => existsSyncPaths.has(path)),
  readdirSync: mock((_path: string) => readdirSyncResult),
}));

mock.module("node:os", () => ({
  homedir: mock(() => "/home/testuser"),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

const {
  isMcpCliAvailable,
  queryContext7,
  resolveContext7Library,
  queryContext7Batch,
  resetMcpCliCache,
} = await import("../../../src/lib/mcp-client.js");

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetMcpCliCache();
  execSyncBehavior = "error";
  execSyncResults = [];
  execSyncCallCount = 0;
  spawnChildren = [];
  spawnCallCount = 0;
  existsSyncPaths = new Set();
  readdirSyncResult = [];
});

// ---------------------------------------------------------------------------
// isMcpCliAvailable
// ---------------------------------------------------------------------------

describe("isMcpCliAvailable", () => {
  test("returns true when mcp-cli is in PATH and --version succeeds", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const child = pushChild();
    const promise = isMcpCliAvailable();
    setTimeout(() => child.emit("close", 0), 5);

    expect(await promise).toBe(true);
  });

  test("returns false when mcp-cli is not in PATH and no Claude Code", async () => {
    execSyncBehavior = "error";

    expect(await isMcpCliAvailable()).toBe(false);
  });

  test("returns false when --version exits non-zero", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const child = pushChild();
    const promise = isMcpCliAvailable();
    setTimeout(() => child.emit("close", 1), 5);

    expect(await promise).toBe(false);
  });

  test("returns false when spawn emits error", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const child = pushChild();
    const promise = isMcpCliAvailable();
    setTimeout(() => child.emit("error", new Error("ENOENT")), 5);

    expect(await promise).toBe(false);
  });

  test("caches result on subsequent calls", async () => {
    execSyncBehavior = "error";
    const result1 = await isMcpCliAvailable();
    expect(result1).toBe(false);

    // Even if we change the mock, cached result remains
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const result2 = await isMcpCliAvailable();
    expect(result2).toBe(false);
  });

  test("finds Claude Code at home .local/share/claude path", async () => {
    execSyncBehavior = "error"; // mcp-cli not in PATH
    existsSyncPaths.add("/home/testuser/.local/share/claude");
    existsSyncPaths.add("/home/testuser/.local/share/claude/claude");

    const child = pushChild();
    const promise = isMcpCliAvailable();
    setTimeout(() => child.emit("close", 0), 5);

    expect(await promise).toBe(true);
  });

  test("finds versioned Claude Code installation", async () => {
    execSyncBehavior = "error";
    existsSyncPaths.add("/home/testuser/.local/share/claude/versions");
    readdirSyncResult = ["1.0.0", "1.1.0"];
    // Simulate the versioned path existing
    existsSyncPaths.add("/home/testuser/.local/share/claude/versions/1.1.0");

    const child = pushChild();
    const promise = isMcpCliAvailable();
    setTimeout(() => child.emit("close", 0), 5);

    expect(await promise).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// queryContext7 (mcp-client subprocess version)
// ---------------------------------------------------------------------------

describe("queryContext7 (mcp-client)", () => {
  test("returns error when mcp-cli is not available", async () => {
    execSyncBehavior = "error";

    const result = await queryContext7("/honojs/hono", "routing");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not available");
  });

  test("returns content on successful call", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    // Child 1: isMcpCliAvailable --version
    const versionChild = pushChild();
    // Child 2: the actual query call
    const queryChild = pushChild();

    const availPromise = isMcpCliAvailable();
    setTimeout(() => versionChild.emit("close", 0), 5);
    await availPromise;

    const queryPromise = queryContext7("/honojs/hono", "routing");
    setTimeout(() => {
      queryChild.stdout.emit("data", Buffer.from('{"content": "docs content"}'));
      queryChild.emit("close", 0);
    }, 10);

    const result = await queryPromise;
    expect(result.success).toBe(true);
    expect(result.content).toContain("docs content");
  });

  test("returns error when call fails with stderr", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const versionChild = pushChild();
    const queryChild = pushChild();

    const availPromise = isMcpCliAvailable();
    setTimeout(() => versionChild.emit("close", 0), 5);
    await availPromise;

    const queryPromise = queryContext7("/honojs/hono", "routing");
    setTimeout(() => {
      queryChild.stderr.emit("data", Buffer.from("Connection refused"));
      queryChild.emit("close", 1);
    }, 10);

    const result = await queryPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain("Connection refused");
  });

  test("returns error when spawn emits error during call", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const versionChild = pushChild();
    const queryChild = pushChild();

    const availPromise = isMcpCliAvailable();
    setTimeout(() => versionChild.emit("close", 0), 5);
    await availPromise;

    const queryPromise = queryContext7("/honojs/hono", "routing");
    setTimeout(() => {
      queryChild.emit("error", new Error("spawn failed"));
    }, 10);

    const result = await queryPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain("spawn");
  });

  test("handles duplicate close events gracefully", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const versionChild = pushChild();
    const queryChild = pushChild();

    const availPromise = isMcpCliAvailable();
    setTimeout(() => versionChild.emit("close", 0), 5);
    await availPromise;

    const queryPromise = queryContext7("/honojs/hono", "routing");
    setTimeout(() => {
      queryChild.stdout.emit("data", Buffer.from("result"));
      queryChild.emit("close", 0);
      // Duplicate close is ignored (already resolved)
      queryChild.emit("close", 1);
    }, 10);

    const result = await queryPromise;
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveContext7Library
// ---------------------------------------------------------------------------

describe("resolveContext7Library", () => {
  test("returns error when mcp-cli is not available", async () => {
    execSyncBehavior = "error";

    const result = await resolveContext7Library("hono");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not available");
  });

  test("makes call and returns result when available", async () => {
    execSyncBehavior = "success";
    execSyncResults = ["/usr/local/bin/mcp-cli\n"];
    existsSyncPaths.add("/usr/local/bin/mcp-cli");

    const versionChild = pushChild();
    const resolveChild = pushChild();

    const availPromise = isMcpCliAvailable();
    setTimeout(() => versionChild.emit("close", 0), 5);
    await availPromise;

    const resolvePromise = resolveContext7Library("hono");
    setTimeout(() => {
      resolveChild.stdout.emit(
        "data",
        Buffer.from(JSON.stringify({ libraryId: "/honojs/hono" }))
      );
      resolveChild.emit("close", 0);
    }, 10);

    const result = await resolvePromise;
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// queryContext7Batch
// ---------------------------------------------------------------------------

describe("queryContext7Batch", () => {
  test("returns empty array for empty queries", async () => {
    const results = await queryContext7Batch([]);
    expect(results).toEqual([]);
  });

  test("processes queries with progress callback", async () => {
    execSyncBehavior = "error"; // not available -> all fail fast

    const progress: Array<[number, number]> = [];

    const results = await queryContext7Batch(
      [
        { category: "api", file: "routing.mdx", query: "routing", libraryId: "/honojs/hono" },
        { category: "api", file: "context.mdx", query: "context", libraryId: "/honojs/hono" },
      ],
      (completed, total) => {
        progress.push([completed, total]);
      }
    );

    expect(results.length).toBe(2);
    expect(results[0].result.success).toBe(false);
    expect(results[1].result.success).toBe(false);
    expect(progress.length).toBe(2);
  });
});
