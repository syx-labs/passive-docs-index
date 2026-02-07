/**
 * Global Test Setup
 * Preloaded by bun:test via bunfig.toml to reset cached state between tests.
 */

import { afterEach, beforeEach } from "bun:test";
import { resetClients } from "../../src/lib/context7-client.js";
import { resetMcpCliCache } from "../../src/lib/mcp-client.js";

// Reset all cached state between tests to prevent leakage
beforeEach(() => {
  resetClients();
  resetMcpCliCache();
});

// Placeholder for future leak detection logic
afterEach(() => {
  // intentionally empty
});
