/**
 * Fetch Mock Helper
 * Provides route-based fetch interception using spyOn(global, 'fetch').
 * Validates URLs and payloads, not just return values.
 */

import { spyOn } from "bun:test";

export interface FetchRoute {
  /** URL pattern to match -- string (substring match) or RegExp */
  pattern: string | RegExp;
  /** HTTP method to match (optional -- matches any if not set) */
  method?: string;
  /** Response to return -- static Response or dynamic function */
  response:
    | Response
    | ((url: string, options?: RequestInit) => Response | Promise<Response>);
}

/**
 * Create a fetch mock that intercepts global fetch based on route patterns.
 * Unmatched requests throw an error (fail loudly).
 *
 * @example
 * ```ts
 * const fetchSpy = createFetchMock([
 *   {
 *     pattern: "/api/search",
 *     method: "POST",
 *     response: Response.json([{ id: "/honojs/hono", name: "Hono" }]),
 *   },
 * ]);
 * ```
 */
export function createFetchMock(routes: FetchRoute[]) {
  return spyOn(global, "fetch").mockImplementation(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method || "GET";

      for (const route of routes) {
        const matches =
          typeof route.pattern === "string"
            ? url.includes(route.pattern)
            : route.pattern.test(url);

        if (matches && (!route.method || route.method === method)) {
          return typeof route.response === "function"
            ? route.response(url, init)
            : route.response.clone();
        }
      }

      throw new Error(`Unmocked fetch: ${method} ${url}`);
    }
  );
}
