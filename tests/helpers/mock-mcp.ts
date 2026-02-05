/**
 * MCP Client Mock Helpers
 * Provides FakeMcpClient for testing code that interacts with MCP CLI.
 * Also provides a prompts mock helper for interactive command testing.
 */

import { mock } from "bun:test";
import type { IMcpClient, McpResult } from "../../src/lib/interfaces/mcp-client.js";

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

/**
 * Create a mock for the `prompts` library that returns predetermined responses.
 *
 * @example
 * ```ts
 * import { mock } from "bun:test";
 * const promptsMock = createPromptsMock({ frameworks: ["hono"], confirm: true });
 * mock.module("prompts", () => ({ default: promptsMock }));
 * ```
 */
export function createPromptsMock(
  responses: Record<string, unknown>,
): ReturnType<typeof mock> {
  return mock(async () => responses);
}
