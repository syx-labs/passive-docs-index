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

// Safety check: ensure no leaked state after each test
afterEach(() => {
  // Intentionally empty for now -- Phase 4 will add leak detection
});
