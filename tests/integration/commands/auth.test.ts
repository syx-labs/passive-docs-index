/**
 * Integration Tests: auth command
 *
 * Tests the auth command flow with all I/O mocked:
 * - Filesystem (node:fs, node:fs/promises)
 * - Console output, ora, chalk
 * - Prompts (interactive input)
 * - Context7 availability check
 * - homedir() for global config path
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { createMockFs } from "../../helpers/mock-fs.js";

// ---------------------------------------------------------------------------
// Filesystem mocks
// ---------------------------------------------------------------------------

const { files, fsMock, fsPromisesMock } = createMockFs();

mock.module("node:fs", () => fsMock);
mock.module("node:fs/promises", () => fsPromisesMock);

// ---------------------------------------------------------------------------
// Mock homedir
// ---------------------------------------------------------------------------

mock.module("node:os", () => ({
  homedir: () => "/home/testuser",
}));

// ---------------------------------------------------------------------------
// Mock ora
// ---------------------------------------------------------------------------

mock.module("ora", () => ({
  default: () => ({
    start: mock(function (this: Record<string, unknown>) {
      return this;
    }),
    succeed: mock(),
    fail: mock(),
    warn: mock(),
    info: mock(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock chalk (pass-through)
// ---------------------------------------------------------------------------

mock.module("chalk", () => {
  const passthrough = (s: string) => s;
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === "default") {
        return new Proxy({}, handler);
      }
      if (prop === "__esModule") {
        return true;
      }
      return passthrough;
    },
    apply: (_target, _this, args) => args[0],
  };
  return { default: new Proxy({}, handler) };
});

// ---------------------------------------------------------------------------
// Mock prompts
// ---------------------------------------------------------------------------

let promptsResponse: Record<string, unknown> = {};

mock.module("prompts", () => ({
  default: mock(async () => promptsResponse),
}));

// ---------------------------------------------------------------------------
// Mock context7-client
// ---------------------------------------------------------------------------

let mockAvailability = {
  http: false,
  mcp: false,
  available: false,
  recommended: "offline" as const,
  message: "No source",
};

mock.module("../../../src/lib/context7-client.js", () => ({
  checkAvailability: mock(async () => mockAvailability),
  resetClients: mock(),
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { authCommand, loadApiKeyFromConfig } = await import(
  "../../../src/commands/auth.js"
);

// ---------------------------------------------------------------------------
// Console spies
// ---------------------------------------------------------------------------

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  files.clear();
  promptsResponse = {};
  mockAvailability = {
    http: false,
    mcp: false,
    available: false,
    recommended: "offline" as const,
    message: "No source",
  };
  // biome-ignore lint/performance/noDelete: process.env.X = undefined sets string "undefined", delete is required
  delete process.env.CONTEXT7_API_KEY;
  logSpy = spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  // biome-ignore lint/performance/noDelete: process.env.X = undefined sets string "undefined", delete is required
  delete process.env.CONTEXT7_API_KEY;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authCommand --status", () => {
  test("shows authenticated when HTTP available", async () => {
    mockAvailability = {
      http: true,
      mcp: false,
      available: true,
      recommended: "http",
      message: "HTTP API available",
    };

    await authCommand({ status: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    // The "API key is set" message goes to console.log
    expect(
      logs.some((l) => l.includes("API key") || l.includes("environment"))
    ).toBe(true);
  });

  test("shows saved key when not loaded in env", async () => {
    mockAvailability = {
      http: false,
      mcp: false,
      available: false,
      recommended: "offline",
      message: "No source",
    };

    // Write a global config with a saved API key
    files.set(
      "/home/testuser/.config/pdi/config.json",
      JSON.stringify({ apiKey: "ctx7_test1234567890abcdef" })
    );

    await authCommand({ status: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some(
        (l) =>
          l.includes("saved") ||
          l.includes("not loaded") ||
          l.includes("export")
      )
    ).toBe(true);
  });

  test("shows not authenticated when no key", async () => {
    await authCommand({ status: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(
      logs.some(
        (l) => l.includes("Not authenticated") || l.includes("pdi auth")
      )
    ).toBe(true);
  });

  test("shows MCP fallback info when available", async () => {
    mockAvailability = {
      http: false,
      mcp: true,
      available: true,
      recommended: "mcp",
      message: "MCP available",
    };

    await authCommand({ status: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("MCP"))).toBe(true);
  });
});

describe("authCommand --logout", () => {
  test("removes API key from global config", async () => {
    files.set(
      "/home/testuser/.config/pdi/config.json",
      JSON.stringify({
        apiKey: "ctx7_test1234567890abcdef",
        configuredAt: "2026-01-01",
      })
    );

    await authCommand({ logout: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("removed"))).toBe(true);

    // Verify config was updated (key should be undefined)
    const saved = files.get("/home/testuser/.config/pdi/config.json");
    expect(saved).toBeDefined();
    const parsed = JSON.parse(saved!);
    expect(parsed.apiKey).toBeUndefined();
  });

  test("shows message when no key configured", async () => {
    await authCommand({ logout: true });

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("No API key configured"))).toBe(true);
  });
});

describe("authCommand interactive", () => {
  test("cancelled when no key entered", async () => {
    promptsResponse = { apiKey: undefined };

    await authCommand({});

    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Cancelled"))).toBe(true);
  });

  test("exits when already authenticated and user declines reconfigure", async () => {
    mockAvailability = {
      http: true,
      mcp: false,
      available: true,
      recommended: "http",
      message: "HTTP available",
    };
    promptsResponse = { reconfigure: false };

    await authCommand({});

    // Should return early without further prompts
    const logs = logSpy.mock.calls.map((c) => c.join(" "));
    expect(logs.some((l) => l.includes("Authentication"))).toBe(true);
  });
});

describe("loadApiKeyFromConfig", () => {
  test("loads API key from global config when not in env", async () => {
    files.set(
      "/home/testuser/.config/pdi/config.json",
      JSON.stringify({ apiKey: "ctx7_loaded_key" })
    );

    await loadApiKeyFromConfig();

    expect(process.env.CONTEXT7_API_KEY).toBe("ctx7_loaded_key");
  });

  test("does not overwrite existing env var", async () => {
    process.env.CONTEXT7_API_KEY = "ctx7_existing";
    files.set(
      "/home/testuser/.config/pdi/config.json",
      JSON.stringify({ apiKey: "ctx7_should_not_use" })
    );

    await loadApiKeyFromConfig();

    expect(process.env.CONTEXT7_API_KEY).toBe("ctx7_existing");
  });

  test("does nothing when no config file exists", async () => {
    await loadApiKeyFromConfig();

    expect(process.env.CONTEXT7_API_KEY).toBeUndefined();
  });
});
