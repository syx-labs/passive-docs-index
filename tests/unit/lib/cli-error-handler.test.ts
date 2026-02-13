/**
 * Unit tests for CLI error handler
 *
 * Tests handleCommandError() with each error type.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { handleCommandError } from "../../../src/lib/error-handler.js";
import {
  ConfigError,
  Context7Error,
  NotInitializedError,
  PDIError,
} from "../../../src/lib/errors.js";

// ============================================================================
// Test setup: mock process.exit and console.error
// ============================================================================

let mockExit: ReturnType<typeof spyOn>;
let mockConsoleError: ReturnType<typeof spyOn>;
let errorOutput: string[];

beforeEach(() => {
  errorOutput = [];
  mockExit = spyOn(process, "exit").mockImplementation((() => {
    throw new Error("process.exit called");
  }) as never);
  mockConsoleError = spyOn(console, "error").mockImplementation(
    (...args: unknown[]) => {
      errorOutput.push(args.map(String).join(" "));
    }
  );
  delete process.env.PDI_DEBUG;
});

afterEach(() => {
  mockExit.mockRestore();
  mockConsoleError.mockRestore();
  delete process.env.PDI_DEBUG;
});

// ============================================================================
// ConfigError
// ============================================================================

describe("handleCommandError - ConfigError", () => {
  test("shows Config Error prefix with validation issues", () => {
    const error = new ConfigError("Config validation failed", {
      configPath: "/path/config.json",
      validationIssues: [
        { path: "version", message: "Expected string, got number" },
      ],
      hint: "Fix the fields above.",
    });

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("Config Error:");
    expect(output).toContain("version: Expected string, got number");
    expect(output).toContain("Fix: Fix the fields above.");
  });

  test("shows hint but no validation block when ConfigError has no issues", () => {
    const error = new ConfigError("Config file is empty", {
      hint: "Run `pdi init --force` to regenerate.",
    });

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("Config Error:");
    expect(output).toContain("Fix: Run `pdi init --force`");
    expect(output).not.toContain("  - ");
  });

  test("calls process.exit(1)", () => {
    const error = new ConfigError("test");
    expect(() => handleCommandError(error)).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

// ============================================================================
// NotInitializedError
// ============================================================================

describe("handleCommandError - NotInitializedError", () => {
  test("shows error message and init hint", () => {
    const error = new NotInitializedError();

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("not initialized");
    expect(output).toContain("pdi init");
  });
});

// ============================================================================
// Context7Error
// ============================================================================

describe("handleCommandError - Context7Error", () => {
  test("shows Context7 Error prefix with hint", () => {
    const error = new Context7Error("Context7 API key is invalid.", {
      category: "auth",
      source: "http",
      hint: "Run `pdi auth` to reconfigure.",
    });

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("Context7 Error:");
    expect(output).toContain("Fix: Run `pdi auth` to reconfigure.");
  });
});

// ============================================================================
// Generic PDIError
// ============================================================================

describe("handleCommandError - PDIError", () => {
  test("shows error message and hint", () => {
    const error = new PDIError("No package.json found", {
      hint: "Run in a project directory.",
    });

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("Error:");
    expect(output).toContain("No package.json found");
    expect(output).toContain("Fix: Run in a project directory.");
  });
});

// ============================================================================
// Plain Error
// ============================================================================

describe("handleCommandError - plain Error", () => {
  test("shows error message without hint", () => {
    const error = new Error("Something went wrong");

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("Error:");
    expect(output).toContain("Something went wrong");
    expect(output).not.toContain("Fix:");
  });

  test("shows cause chain when error has a cause", () => {
    const cause = new Error("Connection refused");
    const error = new Error("Failed to fetch data", { cause });

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("Failed to fetch data");
    expect(output).toContain("Caused by: Connection refused");
  });
});

// ============================================================================
// Non-Error (string)
// ============================================================================

describe("handleCommandError - non-Error", () => {
  test("shows string value", () => {
    expect(() => handleCommandError("unexpected string error")).toThrow(
      "process.exit called"
    );

    const output = errorOutput.join("\n");
    expect(output).toContain("Error:");
    expect(output).toContain("unexpected string error");
  });
});

// ============================================================================
// PDI_DEBUG mode
// ============================================================================

describe("handleCommandError - PDI_DEBUG", () => {
  test("shows stack trace when PDI_DEBUG is set", () => {
    process.env.PDI_DEBUG = "1";
    const error = new PDIError("debug test");

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).toContain("Stack trace:");
  });

  test("does not show stack trace when PDI_DEBUG is not set", () => {
    const error = new PDIError("no debug test");

    expect(() => handleCommandError(error)).toThrow("process.exit called");

    const output = errorOutput.join("\n");
    expect(output).not.toContain("Stack trace:");
  });
});
