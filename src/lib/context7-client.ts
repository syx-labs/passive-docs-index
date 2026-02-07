/**
 * Context7 Unified Client
 * Provides documentation fetching via HTTP SDK (primary) or MCP (fallback)
 *
 * Priority:
 * 1. HTTP SDK (if CONTEXT7_API_KEY is set)
 * 2. MCP via Claude Code (if running inside Claude Code session)
 * 3. Offline mode (returns null, caller handles placeholders)
 */

// NOTE: @upstash/context7-sdk is dynamically imported in getHttpClient()
// to allow bun:test mock.module() to intercept before module resolution.

import type { IMcpClient } from "./interfaces/mcp-client.js";
import { McpCliClient } from "./interfaces/mcp-client.js";
import { extractContext7Content } from "./mcp-client.js";

// Local type matching Context7 SDK's Documentation shape (duck-typed for mock compatibility)
interface Documentation {
  title?: string;
  source?: string;
  content?: string;
}

// ============================================================================
// Types
// ============================================================================

export type Context7Result =
  | {
      success: true;
      content: string;
      docs?: Documentation[];
      source: "http" | "mcp";
    }
  | { success: false; error: string; source: "http" | "mcp" | "none" };

export interface Context7ClientConfig {
  apiKey?: string;
  preferMcp?: boolean; // Force MCP even if API key is available
}

// ============================================================================
// HTTP Client (Primary)
// ============================================================================

/** Duck-typed Context7 client (avoids static import for mock compatibility) */
interface Context7Client {
  getContext(
    query: string,
    libraryId: string,
    options: { type: string }
  ): Promise<Documentation[] | null>;
  searchLibrary(
    query: string,
    libraryName: string,
    options: { type: string }
  ): Promise<Array<{ id: string; name: string; trustScore?: number }> | null>;
}

let httpClient: Context7Client | null = null;
let httpClientApiKey: string | null = null;

/**
 * Get or create the HTTP client.
 * Uses dynamic import so bun:test mock.module() can intercept.
 * @param apiKeyOverride - Optional API key to use instead of environment variable
 */
async function getHttpClient(
  apiKeyOverride?: string
): Promise<Context7Client | null> {
  const requestedKey = apiKeyOverride || process.env.CONTEXT7_API_KEY;

  // If no key available, return null
  if (!requestedKey) {
    httpClient = null;
    httpClientApiKey = null;
    return null;
  }

  // Return cached client if same key
  if (httpClient && httpClientApiKey === requestedKey) {
    return httpClient;
  }

  // Create new client with the requested key (dynamic import)
  try {
    const { Context7 } = await import("@upstash/context7-sdk");
    httpClient = new Context7({ apiKey: requestedKey });
    httpClientApiKey = requestedKey;
    return httpClient;
  } catch (error) {
    console.error("Failed to create Context7 HTTP client:", error);
    httpClient = null;
    httpClientApiKey = null;
    return null;
  }
}

/**
 * Check if HTTP client is available
 * @param apiKeyOverride - Optional API key to check with
 */
export async function isHttpClientAvailable(
  apiKeyOverride?: string
): Promise<boolean> {
  return (await getHttpClient(apiKeyOverride)) !== null;
}

// Cache for resolved library IDs (when redirected)
const libraryIdCache = new Map<string, string>();

/**
 * Convert documentation array to markdown string
 */
function docsToMarkdown(docs: Documentation[]): string {
  return docs
    .map((doc) => {
      const parts: string[] = [];
      if (doc.title) {
        parts.push(`### ${doc.title}`);
      }
      if (doc.source) {
        parts.push(`\nSource: ${doc.source}`);
      }
      if (doc.content) {
        parts.push(`\n${doc.content}`);
      }
      return parts.join("\n");
    })
    .join("\n\n--------------------------------\n\n");
}

/**
 * Resolve the correct library ID if it has been redirected
 */
async function resolveLibraryId(
  client: Context7Client,
  libraryId: string
): Promise<string | null> {
  // Check cache first
  if (libraryIdCache.has(libraryId)) {
    return libraryIdCache.get(libraryId)!;
  }

  try {
    // Extract library name from ID (e.g., "/tailwindlabs/tailwindcss" -> "tailwindcss")
    const parts = libraryId.split("/");
    const libraryName = parts.at(-1) || parts.at(-2) || libraryId;

    const results = await client.searchLibrary(libraryName, libraryName, {
      type: "json",
    });

    if (results && results.length > 0) {
      // Find best match - prefer exact match or highest trust score
      const exactMatch = results.find(
        (r) => r.id.toLowerCase() === libraryId.toLowerCase()
      );

      const bestMatch = exactMatch || results[0];
      libraryIdCache.set(libraryId, bestMatch.id);
      return bestMatch.id;
    }

    return null;
  } catch (error) {
    console.error("Failed to resolve library ID:", libraryId, error);
    return null;
  }
}

/**
 * Query documentation via HTTP SDK
 * @param libraryId - The Context7 library ID
 * @param query - The query/topic to search for
 * @param apiKeyOverride - Optional API key to use
 */
async function queryViaHttp(
  libraryId: string,
  query: string,
  apiKeyOverride?: string
): Promise<Context7Result> {
  const client = await getHttpClient(apiKeyOverride);
  if (!client) {
    return {
      success: false,
      error: "CONTEXT7_API_KEY not set",
      source: "none",
    };
  }

  try {
    const docs = await client.getContext(query, libraryId, { type: "json" });

    if (!docs || docs.length === 0) {
      return {
        success: false,
        error: "No documentation found",
        source: "http",
      };
    }

    const content = docsToMarkdown(docs);

    return {
      success: true,
      content,
      docs,
      source: "http",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "HTTP request failed";

    // Handle library_redirected error - try to resolve the correct ID
    if (
      errorMessage.includes("library_redirected") ||
      errorMessage.includes("redirected")
    ) {
      const resolvedId = await resolveLibraryId(client, libraryId);

      if (resolvedId && resolvedId !== libraryId) {
        // Retry with resolved ID
        try {
          const docs = await client.getContext(query, resolvedId, {
            type: "json",
          });

          if (docs && docs.length > 0) {
            const content = docsToMarkdown(docs);

            return {
              success: true,
              content,
              docs,
              source: "http",
            };
          }
        } catch (retryError) {
          return {
            success: false,
            error: `Redirect resolved to ${resolvedId} but query failed: ${retryError instanceof Error ? retryError.message : "unknown"}`,
            source: "http",
          };
        }
      }

      return {
        success: false,
        error: `Library ID changed. Try: pdi add ${libraryId.split("/").pop()} --force`,
        source: "http",
      };
    }

    return {
      success: false,
      error: errorMessage,
      source: "http",
    };
  }
}

// ============================================================================
// MCP Client (Fallback)
// ============================================================================

/** Default MCP client instance (uses real mcp-cli) */
let defaultMcpClient: IMcpClient = new McpCliClient();

/**
 * Set the MCP client used by queryViaMcp. Primarily for testing.
 */
export function setMcpClient(client: IMcpClient): void {
  defaultMcpClient = client;
}

/**
 * Reset the MCP client to the default McpCliClient.
 */
export function resetMcpClient(): void {
  defaultMcpClient = new McpCliClient();
}

/**
 * Query documentation via MCP
 * @param mcpClient - Optional MCP client to use (defaults to McpCliClient)
 */
async function queryViaMcp(
  libraryId: string,
  query: string,
  mcpClient?: IMcpClient
): Promise<Context7Result> {
  try {
    const client = mcpClient || defaultMcpClient;
    const mcpAvailable = await client.isAvailable();
    if (!mcpAvailable) {
      return {
        success: false,
        error: "MCP not available (Claude Code not running)",
        source: "none",
      };
    }

    const result = await client.queryDocs(libraryId, query);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "MCP query failed",
        source: "mcp",
      };
    }

    // Extract content from MCP response
    const content = extractContext7Content(result.content);

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: "MCP returned empty content",
        source: "mcp",
      };
    }

    return {
      success: true,
      content,
      source: "mcp",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "MCP query failed",
      source: "mcp",
    };
  }
}

// ============================================================================
// Unified Client
// ============================================================================

/**
 * Query Context7 for documentation using the best available method
 *
 * @param libraryId - The Context7 library ID (e.g., "/honojs/hono")
 * @param query - The query/topic to search for
 * @param config - Optional configuration
 */
export async function queryContext7(
  libraryId: string,
  query: string,
  config?: Context7ClientConfig
): Promise<Context7Result> {
  let mcpResult: Context7Result | null = null;

  // Option to force MCP
  if (config?.preferMcp) {
    mcpResult = await queryViaMcp(libraryId, query);
    if (mcpResult.success) {
      return mcpResult;
    }
    // Fall through to HTTP if MCP fails
  }

  // Try HTTP first (if API key is available - from config or env)
  const httpAvailable = await isHttpClientAvailable(config?.apiKey);
  if (httpAvailable) {
    const httpResult = await queryViaHttp(libraryId, query, config?.apiKey);
    if (httpResult.success) {
      return httpResult;
    }
    // Log HTTP failure but continue to MCP fallback
    console.error(`HTTP query failed: ${httpResult.error}`);
  }

  // Try MCP as fallback (skip if already tried via preferMcp)
  if (!mcpResult) {
    mcpResult = await queryViaMcp(libraryId, query);
    if (mcpResult.success) {
      return mcpResult;
    }
  }

  // Both failed
  return {
    success: false,
    error: httpAvailable
      ? `HTTP failed, MCP failed: ${mcpResult.error}`
      : `No API key set, MCP failed: ${mcpResult.error}`,
    source: "none",
  };
}

/**
 * Search for a library by name
 * @param query - Search query
 * @param libraryName - Library name to search for
 * @param apiKeyOverride - Optional API key to use instead of environment variable
 */
export async function searchLibrary(
  query: string,
  libraryName: string,
  apiKeyOverride?: string
): Promise<{ id: string; name: string } | null> {
  const client = await getHttpClient(apiKeyOverride);
  if (!client) {
    return null;
  }

  try {
    const results = await client.searchLibrary(query, libraryName, {
      type: "json",
    });
    if (results && results.length > 0) {
      return {
        id: results[0].id,
        name: results[0].name,
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to search library:", libraryName, error);
    return null;
  }
}

// ============================================================================
// Availability Check
// ============================================================================

export interface AvailabilityStatus {
  http: boolean;
  mcp: boolean;
  available: boolean;
  recommended: "http" | "mcp" | "offline";
  message: string;
}

/**
 * Check what documentation sources are available
 */
export async function checkAvailability(
  mcpClient?: IMcpClient
): Promise<AvailabilityStatus> {
  const http = await isHttpClientAvailable();
  const client = mcpClient || defaultMcpClient;
  const mcp = await client.isAvailable();

  // HTTP is always reliable if available
  // MCP is only reliable inside an active Claude Code session
  const available = http || mcp;

  let recommended: "http" | "mcp" | "offline";
  let message: string;

  if (http) {
    recommended = "http";
    message = "Using Context7 HTTP API (API key configured)";
  } else if (mcp) {
    recommended = "mcp";
    // Warn that MCP might fail outside Claude Code
    message = "MCP available (requires active Claude Code session)";
  } else {
    recommended = "offline";
    message = "No documentation source available. Run: pdi auth";
  }

  return {
    http,
    mcp,
    available,
    recommended,
    message,
  };
}

/**
 * Reset client caches (for testing)
 */
export function resetClients(): void {
  httpClient = null;
  httpClientApiKey = null;
  libraryIdCache.clear();
  resetMcpClient();
}
