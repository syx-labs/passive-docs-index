/**
 * MCP Client via mcp-cli
 * Provides functions to query Context7 MCP server using the mcp-cli command
 *
 * Note: This module uses child_process.execSync for path detection with static commands only.
 * No user input is passed to shell commands - all paths are system-detected constants.
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ============================================================================
// Types
// ============================================================================

export interface MCPResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface Context7QueryParams {
  libraryId: string;
  query: string;
}

export interface Context7ResolveParams {
  libraryName: string;
}

// ============================================================================
// MCP CLI Detection
// ============================================================================

/**
 * Structure to hold CLI command info without naive string splitting.
 * This avoids issues with paths containing spaces (e.g., "/Users/John Doe/...").
 */
interface McpCliInfo {
  cmd: string;
  baseArgs: string[];
}

let mcpCliInfo: McpCliInfo | null = null;
let mcpCliAvailable: boolean | null = null;

const isWindows = process.platform === "win32";

/**
 * Find an executable in PATH using platform-appropriate command.
 * Uses 'where' on Windows, 'which' on POSIX.
 *
 * Security note: Only static command names are passed to execSync,
 * no user input is ever interpolated into shell commands.
 */
function findInPath(executable: string): string | null {
  try {
    // These are static commands with known executable names
    const cmd = isWindows
      ? `where ${executable}`
      : `which ${executable} 2>/dev/null`;
    const result = execSync(cmd, { encoding: "utf-8" }).trim();
    // 'where' on Windows may return multiple lines; take first
    const firstLine = result.split(/\r?\n/)[0];
    if (firstLine && existsSync(firstLine)) {
      return firstLine;
    }
  } catch {
    // Not found
  }
  return null;
}

/**
 * Find the mcp-cli executable info.
 * mcp-cli can be:
 * 1. A standalone executable in PATH
 * 2. Part of Claude Code (claude --mcp-cli)
 *
 * Security note: This function only uses execSync with static commands,
 * no user input is ever passed to shell commands.
 */
function findMcpCliInfo(): McpCliInfo | null {
  // Check if already found
  if (mcpCliInfo !== null) {
    return mcpCliInfo;
  }

  // Try to find standalone mcp-cli in PATH
  const mcpCliExe = findInPath("mcp-cli");
  if (mcpCliExe) {
    mcpCliInfo = { cmd: mcpCliExe, baseArgs: [] };
    return mcpCliInfo;
  }

  // Check common Claude Code installation paths
  const home = homedir();
  const claudePaths = [
    // macOS
    join(home, ".local/share/claude"),
    // Linux
    join(home, ".local/bin"),
    // Windows
    join(home, "AppData", "Local", "Programs", "claude"),
    // Check for versioned claude
    join(home, ".local/share/claude/versions"),
  ];

  for (const basePath of claudePaths) {
    if (!existsSync(basePath)) {
      continue;
    }

    // Check for versioned installations
    if (basePath.endsWith("versions")) {
      try {
        const versions = readdirSync(basePath).sort().reverse();
        for (const version of versions) {
          const versionPath = join(basePath, version);
          const claudeExe = isWindows
            ? join(versionPath, "claude.exe")
            : versionPath;
          if (existsSync(claudeExe)) {
            mcpCliInfo = { cmd: claudeExe, baseArgs: ["--mcp-cli"] };
            return mcpCliInfo;
          }
        }
      } catch {
        // Continue checking
      }
    }

    // Check for direct claude executable
    const claudeExe = isWindows
      ? join(basePath, "claude.exe")
      : join(basePath, "claude");
    if (existsSync(claudeExe)) {
      mcpCliInfo = { cmd: claudeExe, baseArgs: ["--mcp-cli"] };
      return mcpCliInfo;
    }
  }

  // Fallback: try to use 'claude' command if available
  const claudeExe = findInPath(isWindows ? "claude.exe" : "claude");
  if (claudeExe) {
    mcpCliInfo = { cmd: claudeExe, baseArgs: ["--mcp-cli"] };
    return mcpCliInfo;
  }

  mcpCliInfo = null;
  return null;
}

/**
 * Check if mcp-cli is available in the system
 */
export async function isMcpCliAvailable(): Promise<boolean> {
  if (mcpCliAvailable !== null) {
    return mcpCliAvailable;
  }

  const cliInfo = findMcpCliInfo();
  if (!cliInfo) {
    mcpCliAvailable = false;
    return false;
  }

  return new Promise((resolve) => {
    const versionArgs = [...cliInfo.baseArgs, "--version"];

    const child = spawn(cliInfo.cmd, versionArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;

    child.on("close", (code) => {
      if (resolved) {
        return;
      }
      resolved = true;
      mcpCliAvailable = code === 0;
      resolve(mcpCliAvailable);
    });

    child.on("error", () => {
      if (resolved) {
        return;
      }
      resolved = true;
      mcpCliAvailable = false;
      resolve(false);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (resolved) {
        return;
      }
      resolved = true;
      child.kill();
      mcpCliAvailable = false;
      resolve(false);
    }, 5000);
  });
}

/**
 * Reset the mcp-cli availability cache (for testing)
 */
export function resetMcpCliCache(): void {
  mcpCliAvailable = null;
  mcpCliInfo = null;
}

// ============================================================================
// MCP CLI Execution
// ============================================================================

/**
 * Execute an mcp-cli call command
 *
 * Security note: This function uses spawn (not exec) with explicit argument arrays.
 * The tool path and params are passed as separate arguments, not concatenated into a shell string.
 */
async function executeMcpCliCall(
  server: string,
  tool: string,
  params: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<MCPResult> {
  const cliInfo = findMcpCliInfo();
  if (!cliInfo) {
    return {
      success: false,
      error: "mcp-cli not found",
    };
  }

  const toolPath = `${server}/${tool}`;
  const paramsJson = JSON.stringify(params);

  const callArgs = [...cliInfo.baseArgs, "call", toolPath, paramsJson];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let resolved = false;

    const child = spawn(cliInfo.cmd, callArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (resolved) {
        return;
      }
      resolved = true;

      if (code === 0 && stdout.trim()) {
        resolve({
          success: true,
          content: stdout.trim(),
        });
      } else {
        resolve({
          success: false,
          error: stderr.trim() || `mcp-cli exited with code ${code}`,
        });
      }
    });

    child.on("error", (err) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve({
        success: false,
        error: `Failed to spawn mcp-cli: ${err.message}`,
      });
    });

    // Timeout
    setTimeout(() => {
      if (resolved) {
        return;
      }
      resolved = true;
      child.kill();
      resolve({
        success: false,
        error: `mcp-cli call timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);
  });
}

// ============================================================================
// Context7 Functions
// ============================================================================

/**
 * Query Context7 for documentation
 *
 * @param libraryId - The Context7 library ID (e.g., "/honojs/hono")
 * @param query - The query/topic to search for
 */
export async function queryContext7(
  libraryId: string,
  query: string
): Promise<MCPResult> {
  // Check if mcp-cli is available
  const available = await isMcpCliAvailable();
  if (!available) {
    return {
      success: false,
      error: "mcp-cli is not available. Install it or use --offline mode.",
    };
  }

  const params: Context7QueryParams = {
    libraryId,
    query,
  };

  return executeMcpCliCall(
    "plugin_context7_context7",
    "query-docs",
    params as unknown as Record<string, unknown>,
    60_000 // 60 second timeout for doc queries
  );
}

/**
 * Resolve a library name to a Context7 library ID
 *
 * @param libraryName - The library name to resolve (e.g., "hono")
 */
export async function resolveContext7Library(
  libraryName: string
): Promise<MCPResult> {
  const available = await isMcpCliAvailable();
  if (!available) {
    return {
      success: false,
      error: "mcp-cli is not available.",
    };
  }

  const params: Context7ResolveParams = {
    libraryName,
  };

  return executeMcpCliCall(
    "plugin_context7_context7",
    "resolve-library-id",
    params as unknown as Record<string, unknown>,
    30_000 // 30 second timeout for resolution
  );
}

// ============================================================================
// Batch Query Helpers
// ============================================================================

export interface BatchQueryItem {
  category: string;
  file: string;
  query: string;
  libraryId: string;
}

export interface BatchQueryResult {
  item: BatchQueryItem;
  result: MCPResult;
}

/**
 * Execute multiple Context7 queries sequentially
 * Sequential to avoid overwhelming the MCP server
 */
export async function queryContext7Batch(
  queries: BatchQueryItem[],
  onProgress?: (
    completed: number,
    total: number,
    current: BatchQueryItem
  ) => void
): Promise<BatchQueryResult[]> {
  const results: BatchQueryResult[] = [];

  for (let i = 0; i < queries.length; i++) {
    const item = queries[i];

    if (onProgress) {
      onProgress(i, queries.length, item);
    }

    const result = await queryContext7(item.libraryId, item.query);
    results.push({ item, result });

    // Small delay between queries to be nice to the server
    if (i < queries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

// ============================================================================
// Content Extraction
// ============================================================================

/**
 * Extract the actual documentation content from a Context7 response
 * The response may be wrapped in JSON or other formats
 */
export function extractContext7Content(rawResponse: string): string {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(rawResponse);

    // Handle various response formats
    if (typeof parsed === "string") {
      return parsed;
    }

    // Handle array format from Context7 (array of content blocks)
    if (Array.isArray(parsed)) {
      // Extract text content from each block
      const textParts: string[] = [];
      for (const block of parsed) {
        if (typeof block === "string") {
          textParts.push(block);
        } else if (block.text) {
          textParts.push(block.text);
        } else if (block.content) {
          textParts.push(
            typeof block.content === "string"
              ? block.content
              : JSON.stringify(block.content)
          );
        }
      }
      if (textParts.length > 0) {
        return textParts.join("\n\n");
      }
    }

    if (parsed.content) {
      // Handle content that might be an array (MCP format)
      if (Array.isArray(parsed.content)) {
        const textParts: string[] = [];
        for (const block of parsed.content) {
          if (typeof block === "string") {
            textParts.push(block);
          } else if (block.text) {
            textParts.push(block.text);
          }
        }
        if (textParts.length > 0) {
          return textParts.join("\n\n");
        }
      }
      return typeof parsed.content === "string"
        ? parsed.content
        : JSON.stringify(parsed.content);
    }

    if (parsed.result) {
      return typeof parsed.result === "string"
        ? parsed.result
        : JSON.stringify(parsed.result);
    }

    if (parsed.text) {
      return parsed.text;
    }

    // If it's an object with documentation-like properties, stringify nicely
    if (parsed.documentation || parsed.docs || parsed.body) {
      return parsed.documentation || parsed.docs || parsed.body;
    }

    // Fallback: stringify the whole thing
    return JSON.stringify(parsed, null, 2);
  } catch {
    // Not JSON, return as-is
    return rawResponse;
  }
}
