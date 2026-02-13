/**
 * Unit tests for src/lib/errors.ts
 *
 * Tests the error class hierarchy: PDIError, ConfigError, Context7Error, NotInitializedError.
 */

import { describe, expect, test } from "bun:test";
import {
  ConfigError,
  Context7Error,
  NotInitializedError,
  PDIError,
} from "../../../src/lib/errors.js";

// ============================================================================
// PDIError
// ============================================================================

describe("PDIError", () => {
  test("creates with message only (defaults)", () => {
    const error = new PDIError("something failed");
    expect(error.message).toBe("something failed");
    expect(error.code).toBe("PDI_ERROR");
    expect(error.hint).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  test("creates with all options", () => {
    const cause = new Error("root cause");
    const error = new PDIError("something failed", {
      code: "CUSTOM_CODE",
      hint: "Try this fix.",
      cause,
    });
    expect(error.code).toBe("CUSTOM_CODE");
    expect(error.hint).toBe("Try this fix.");
    expect(error.cause).toBe(cause);
  });

  test("is instanceof Error", () => {
    const error = new PDIError("test");
    expect(error).toBeInstanceOf(Error);
  });

  test('has name "PDIError"', () => {
    const error = new PDIError("test");
    expect(error.name).toBe("PDIError");
  });

  test("cause preserves original error", () => {
    const original = new TypeError("bad type");
    const error = new PDIError("wrapper", { cause: original });
    expect(error.cause).toBe(original);
    expect(error.cause?.message).toBe("bad type");
  });
});

// ============================================================================
// ConfigError
// ============================================================================

describe("ConfigError", () => {
  test("creates with message only (defaults)", () => {
    const error = new ConfigError("config broken");
    expect(error.message).toBe("config broken");
    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.configPath).toBeUndefined();
    expect(error.validationIssues).toBeUndefined();
  });

  test("creates with configPath and validationIssues", () => {
    const error = new ConfigError("validation failed", {
      configPath: "/path/to/config.json",
      validationIssues: [
        { path: "version", message: "Expected string, got number" },
        {
          path: "project.type",
          message: "Invalid enum value",
          expected: '"backend" | "frontend"',
        },
      ],
    });
    expect(error.configPath).toBe("/path/to/config.json");
    expect(error.validationIssues).toHaveLength(2);
    expect(error.validationIssues![0].path).toBe("version");
  });

  test("is instanceof PDIError (inheritance)", () => {
    const error = new ConfigError("test");
    expect(error).toBeInstanceOf(PDIError);
  });

  test("is instanceof ConfigError", () => {
    const error = new ConfigError("test");
    expect(error).toBeInstanceOf(ConfigError);
  });

  test('has name "ConfigError"', () => {
    const error = new ConfigError("test");
    expect(error.name).toBe("ConfigError");
  });

  test("formatValidationIssues() returns readable multi-line string", () => {
    const error = new ConfigError("test", {
      validationIssues: [
        { path: "version", message: "Expected string, got number" },
        { path: "project.type", message: "Invalid enum value" },
      ],
    });
    const formatted = error.formatValidationIssues();
    expect(formatted).toContain("version: Expected string, got number");
    expect(formatted).toContain("project.type: Invalid enum value");
  });

  test("formatValidationIssues() handles empty issues", () => {
    const error = new ConfigError("test", { validationIssues: [] });
    expect(error.formatValidationIssues()).toBe("");
  });

  test("formatValidationIssues() handles undefined issues", () => {
    const error = new ConfigError("test");
    expect(error.formatValidationIssues()).toBe("");
  });

  test("formatValidationIssues() includes expected values when present", () => {
    const error = new ConfigError("test", {
      validationIssues: [
        {
          path: "project.type",
          message: "Invalid enum value",
          expected: '"backend" | "frontend"',
        },
      ],
    });
    const formatted = error.formatValidationIssues();
    expect(formatted).toContain('expected "backend" | "frontend"');
  });
});

// ============================================================================
// Context7Error
// ============================================================================

describe("Context7Error", () => {
  test("creates with defaults", () => {
    const error = new Context7Error("context7 failed");
    expect(error.category).toBe("unknown");
    expect(error.source).toBe("none");
    expect(error.code).toBe("CONTEXT7_ERROR");
  });

  test("creates with specific category and source", () => {
    const error = new Context7Error("auth failed", {
      category: "auth",
      source: "http",
      hint: "Run pdi auth",
    });
    expect(error.category).toBe("auth");
    expect(error.source).toBe("http");
    expect(error.hint).toBe("Run pdi auth");
  });

  test("is instanceof PDIError (inheritance)", () => {
    const error = new Context7Error("test");
    expect(error).toBeInstanceOf(PDIError);
  });

  test('has name "Context7Error"', () => {
    const error = new Context7Error("test");
    expect(error.name).toBe("Context7Error");
  });
});

// ============================================================================
// NotInitializedError
// ============================================================================

describe("NotInitializedError", () => {
  test("has fixed message and hint", () => {
    const error = new NotInitializedError();
    expect(error.message).toBe("PDI not initialized in this project.");
    expect(error.hint).toBe("Run `pdi init` to initialize.");
  });

  test("is instanceof PDIError", () => {
    const error = new NotInitializedError();
    expect(error).toBeInstanceOf(PDIError);
  });

  test('has code "NOT_INITIALIZED"', () => {
    const error = new NotInitializedError();
    expect(error.code).toBe("NOT_INITIALIZED");
  });

  test('has name "NotInitializedError"', () => {
    const error = new NotInitializedError();
    expect(error.name).toBe("NotInitializedError");
  });
});
