/**
 * PDI Error Types
 * Structured error hierarchy for user-friendly CLI error messages
 */

// ============================================================================
// Validation Issue Type
// ============================================================================

export interface ValidationIssue {
  path: string;
  message: string;
  expected?: string;
}

// ============================================================================
// Base Error
// ============================================================================

export class PDIError extends Error {
  readonly code: string;
  readonly hint?: string;
  override readonly cause?: Error;

  constructor(
    message: string,
    options?: { code?: string; hint?: string; cause?: Error }
  ) {
    super(message);
    this.name = "PDIError";
    this.code = options?.code ?? "PDI_ERROR";
    this.hint = options?.hint;
    this.cause = options?.cause;
  }
}

// ============================================================================
// Config Error
// ============================================================================

export class ConfigError extends PDIError {
  readonly configPath?: string;
  readonly validationIssues?: ValidationIssue[];

  constructor(
    message: string,
    options?: {
      configPath?: string;
      validationIssues?: ValidationIssue[];
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, {
      code: "CONFIG_INVALID",
      hint: options?.hint,
      cause: options?.cause,
    });
    this.name = "ConfigError";
    this.configPath = options?.configPath;
    this.validationIssues = options?.validationIssues;
  }

  formatValidationIssues(): string {
    if (!this.validationIssues || this.validationIssues.length === 0) {
      return "";
    }
    return this.validationIssues
      .map((issue) => {
        const expected = issue.expected ? `, expected ${issue.expected}` : "";
        return `  - ${issue.path}: ${issue.message}${expected}`;
      })
      .join("\n");
  }
}

// ============================================================================
// Context7 Error
// ============================================================================

export class Context7Error extends PDIError {
  readonly category:
    | "auth"
    | "network"
    | "rate_limit"
    | "redirect"
    | "not_found"
    | "unknown";
  readonly source: "http" | "mcp" | "none";

  constructor(
    message: string,
    options?: {
      category?:
        | "auth"
        | "network"
        | "rate_limit"
        | "redirect"
        | "not_found"
        | "unknown";
      source?: "http" | "mcp" | "none";
      hint?: string;
      cause?: Error;
    }
  ) {
    super(message, {
      code: "CONTEXT7_ERROR",
      hint: options?.hint,
      cause: options?.cause,
    });
    this.name = "Context7Error";
    this.category = options?.category ?? "unknown";
    this.source = options?.source ?? "none";
  }
}

// ============================================================================
// Not Initialized Error
// ============================================================================

export class NotInitializedError extends PDIError {
  constructor() {
    super("PDI not initialized in this project.", {
      code: "NOT_INITIALIZED",
      hint: "Run `pdi init` to initialize.",
    });
    this.name = "NotInitializedError";
  }
}
