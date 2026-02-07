/**
 * MCP Client Interface
 * Provides a clean abstraction over MCP CLI interactions for testability.
 *
 * This interface provides a clean abstraction for testability and future
 * extensibility (e.g., enhanced error handling, Claude Code Skills integration).
 */

import {
  isMcpCliAvailable,
  type MCPResult,
  queryContext7,
  resolveContext7Library,
} from "../mcp-client.js";

// Re-export MCPResult as McpResult for backward compatibility
export type McpResult = MCPResult;

// ============================================================================
// Interface
// ============================================================================

/**
 * Abstract interface for MCP client interactions.
 * Production code uses McpCliClient; tests use FakeMcpClient.
 */
export interface IMcpClient {
  /** Check if the MCP client is available */
  isAvailable(): Promise<boolean>;

  /** Query documentation for a library */
  queryDocs(libraryId: string, query: string): Promise<McpResult>;

  /** Resolve a library name to a Context7 library ID */
  resolveLibrary(libraryName: string): Promise<McpResult>;
}

// ============================================================================
// Production Implementation
// ============================================================================

/**
 * Production MCP client that wraps the existing mcp-client.ts functions.
 * Uses child_process.spawn under the hood to communicate with mcp-cli.
 */
export class McpCliClient implements IMcpClient {
  async isAvailable(): Promise<boolean> {
    return isMcpCliAvailable();
  }

  async queryDocs(libraryId: string, query: string): Promise<McpResult> {
    return queryContext7(libraryId, query);
  }

  async resolveLibrary(libraryName: string): Promise<McpResult> {
    return resolveContext7Library(libraryName);
  }
}
