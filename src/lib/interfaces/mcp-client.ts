/**
 * MCP Client Interface
 * Provides a clean abstraction over MCP CLI interactions for testability.
 *
 * This interface is designed for Phase 4 (Error Handling) and Phase 6
 * (Claude Code Skills) to build on -- not a throwaway test seam.
 */

import {
  isMcpCliAvailable,
  queryContext7,
  resolveContext7Library,
  type MCPResult,
} from "../mcp-client.js";

// ============================================================================
// Types
// ============================================================================

/** Result of an MCP operation */
export interface McpResult {
  success: boolean;
  content?: string;
  error?: string;
}

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
    const result: MCPResult = await queryContext7(libraryId, query);
    return {
      success: result.success,
      content: result.content,
      error: result.error,
    };
  }

  async resolveLibrary(libraryName: string): Promise<McpResult> {
    const result: MCPResult = await resolveContext7Library(libraryName);
    return {
      success: result.success,
      content: result.content,
      error: result.error,
    };
  }
}

// ============================================================================
// Test Implementation
// ============================================================================

/**
 * Fake MCP client for testing -- no subprocess, no network.
 * Configure responses via setAvailable() and setResponse().
 */
export class FakeMcpClient implements IMcpClient {
  private available = true;
  private responses = new Map<string, McpResult>();

  /** Set whether the client reports as available */
  setAvailable(available: boolean): void {
    this.available = available;
  }

  /**
   * Set a canned response for a specific key.
   * For queryDocs: key is `${libraryId}:${query}`
   * For resolveLibrary: key is `resolve:${libraryName}`
   */
  setResponse(key: string, result: McpResult): void {
    this.responses.set(key, result);
  }

  /** Clear all configured responses */
  clearResponses(): void {
    this.responses.clear();
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async queryDocs(libraryId: string, query: string): Promise<McpResult> {
    return (
      this.responses.get(`${libraryId}:${query}`) ?? {
        success: false,
        error: "not configured",
      }
    );
  }

  async resolveLibrary(libraryName: string): Promise<McpResult> {
    return (
      this.responses.get(`resolve:${libraryName}`) ?? {
        success: false,
        error: "not configured",
      }
    );
  }
}
