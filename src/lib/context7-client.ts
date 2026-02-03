/**
 * Context7 Unified Client
 * Provides documentation fetching via HTTP SDK (primary) or MCP (fallback)
 *
 * Priority:
 * 1. HTTP SDK (if CONTEXT7_API_KEY is set)
 * 2. MCP via Claude Code (if running inside Claude Code session)
 * 3. Offline mode (returns null, caller handles placeholders)
 */

import { Context7, type Documentation } from '@upstash/context7-sdk';

// ============================================================================
// Types
// ============================================================================

export interface Context7Result {
  success: boolean;
  content?: string;
  docs?: Documentation[];
  error?: string;
  source: 'http' | 'mcp' | 'none';
}

export interface Context7ClientConfig {
  apiKey?: string;
  preferMcp?: boolean; // Force MCP even if API key is available
}

// ============================================================================
// HTTP Client (Primary)
// ============================================================================

let httpClient: Context7 | null = null;
let httpClientApiKey: string | null = null;

/**
 * Get or create the HTTP client
 * @param apiKeyOverride - Optional API key to use instead of environment variable
 */
function getHttpClient(apiKeyOverride?: string): Context7 | null {
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

  // Create new client with the requested key
  try {
    httpClient = new Context7({ apiKey: requestedKey });
    httpClientApiKey = requestedKey;
    return httpClient;
  } catch {
    httpClient = null;
    httpClientApiKey = null;
    return null;
  }
}

/**
 * Check if HTTP client is available
 * @param apiKeyOverride - Optional API key to check with
 */
export function isHttpClientAvailable(apiKeyOverride?: string): boolean {
  return getHttpClient(apiKeyOverride) !== null;
}

// Cache for resolved library IDs (when redirected)
const libraryIdCache = new Map<string, string>();

/**
 * Resolve the correct library ID if it has been redirected
 */
async function resolveLibraryId(
  client: Context7,
  libraryId: string
): Promise<string | null> {
  // Check cache first
  if (libraryIdCache.has(libraryId)) {
    return libraryIdCache.get(libraryId)!;
  }

  try {
    // Extract library name from ID (e.g., "/tailwindlabs/tailwindcss" -> "tailwindcss")
    const parts = libraryId.split('/');
    const libraryName = parts[parts.length - 1] || parts[parts.length - 2] || libraryId;

    const results = await client.searchLibrary(libraryName, libraryName, { type: 'json' });

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
  } catch {
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
  const client = getHttpClient(apiKeyOverride);
  if (!client) {
    return {
      success: false,
      error: 'CONTEXT7_API_KEY not set',
      source: 'none',
    };
  }

  try {
    const docs = await client.getContext(query, libraryId, { type: 'json' });

    if (!docs || docs.length === 0) {
      return {
        success: false,
        error: 'No documentation found',
        source: 'http',
      };
    }

    // Convert docs array to markdown content
    const content = docs
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
        return parts.join('\n');
      })
      .join('\n\n--------------------------------\n\n');

    return {
      success: true,
      content,
      docs,
      source: 'http',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'HTTP request failed';

    // Handle library_redirected error - try to resolve the correct ID
    if (errorMessage.includes('library_redirected') || errorMessage.includes('redirected')) {
      const resolvedId = await resolveLibraryId(client, libraryId);

      if (resolvedId && resolvedId !== libraryId) {
        // Retry with resolved ID
        try {
          const docs = await client.getContext(query, resolvedId, { type: 'json' });

          if (docs && docs.length > 0) {
            const content = docs
              .map((doc) => {
                const parts: string[] = [];
                if (doc.title) parts.push(`### ${doc.title}`);
                if (doc.source) parts.push(`\nSource: ${doc.source}`);
                if (doc.content) parts.push(`\n${doc.content}`);
                return parts.join('\n');
              })
              .join('\n\n--------------------------------\n\n');

            return {
              success: true,
              content,
              docs,
              source: 'http',
            };
          }
        } catch (retryError) {
          return {
            success: false,
            error: `Redirect resolved to ${resolvedId} but query failed: ${retryError instanceof Error ? retryError.message : 'unknown'}`,
            source: 'http',
          };
        }
      }

      return {
        success: false,
        error: `Library ID changed. Try: pdi add ${libraryId.split('/').pop()} --force`,
        source: 'http',
      };
    }

    return {
      success: false,
      error: errorMessage,
      source: 'http',
    };
  }
}

// ============================================================================
// MCP Client (Fallback)
// ============================================================================

// Import MCP client functions
import {
  isMcpCliAvailable,
  queryContext7 as queryViaMcpCli,
  extractContext7Content,
} from './mcp-client.js';

/**
 * Query documentation via MCP
 */
async function queryViaMcp(
  libraryId: string,
  query: string
): Promise<Context7Result> {
  const mcpAvailable = await isMcpCliAvailable();
  if (!mcpAvailable) {
    return {
      success: false,
      error: 'MCP not available (Claude Code not running)',
      source: 'none',
    };
  }

  const result = await queryViaMcpCli(libraryId, query);

  if (!result.success || !result.content) {
    return {
      success: false,
      error: result.error || 'MCP query failed',
      source: 'mcp',
    };
  }

  // Extract content from MCP response
  const content = extractContext7Content(result.content);

  return {
    success: true,
    content,
    source: 'mcp',
  };
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
  // Option to force MCP
  if (config?.preferMcp) {
    const mcpResult = await queryViaMcp(libraryId, query);
    if (mcpResult.success) {
      return mcpResult;
    }
    // Fall through to HTTP if MCP fails
  }

  // Try HTTP first (if API key is available - from config or env)
  const httpAvailable = isHttpClientAvailable(config?.apiKey);
  if (httpAvailable) {
    const httpResult = await queryViaHttp(libraryId, query, config?.apiKey);
    if (httpResult.success) {
      return httpResult;
    }
    // Log HTTP failure but continue to MCP fallback
    console.error(`HTTP query failed: ${httpResult.error}`);
  }

  // Try MCP as fallback
  const mcpResult = await queryViaMcp(libraryId, query);
  if (mcpResult.success) {
    return mcpResult;
  }

  // Both failed
  return {
    success: false,
    error: httpAvailable
      ? `HTTP failed, MCP failed: ${mcpResult.error}`
      : `No API key set, MCP failed: ${mcpResult.error}`,
    source: 'none',
  };
}

/**
 * Search for a library by name
 */
export async function searchLibrary(
  query: string,
  libraryName: string
): Promise<{ id: string; name: string } | null> {
  const client = getHttpClient();
  if (!client) {
    return null;
  }

  try {
    const results = await client.searchLibrary(query, libraryName, { type: 'json' });
    if (results && results.length > 0) {
      return {
        id: results[0].id,
        name: results[0].name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Availability Check
// ============================================================================

export type AvailabilityStatus = {
  http: boolean;
  mcp: boolean;
  available: boolean;
  recommended: 'http' | 'mcp' | 'offline';
  message: string;
};

/**
 * Check what documentation sources are available
 */
export async function checkAvailability(): Promise<AvailabilityStatus> {
  const http = isHttpClientAvailable();
  const mcp = await isMcpCliAvailable();

  // HTTP is always reliable if available
  // MCP is only reliable inside an active Claude Code session
  const available = http || mcp;

  let recommended: 'http' | 'mcp' | 'offline';
  let message: string;

  if (http) {
    recommended = 'http';
    message = 'Using Context7 HTTP API (API key configured)';
  } else if (mcp) {
    recommended = 'mcp';
    // Warn that MCP might fail outside Claude Code
    message = 'MCP available (requires active Claude Code session)';
  } else {
    recommended = 'offline';
    message = 'No documentation source available. Run: pdi auth';
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
}
