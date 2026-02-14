/**
 * CLI Error Handler
 * Formats errors based on type and exits with code 1.
 * Note: Some commands may exit with different codes for specific conditions (e.g., --check mode).
 */

import chalk from "chalk";
import {
  ConfigError,
  Context7Error,
  NotInitializedError,
  PDIError,
} from "./errors.js";

export function handleCommandError(error: unknown): never {
  if (error instanceof ConfigError) {
    console.error(chalk.red("Config Error:"), error.message);
    if (error.validationIssues && error.validationIssues.length > 0) {
      console.error(chalk.dim(error.formatValidationIssues()));
    }
  } else if (error instanceof NotInitializedError) {
    console.error(chalk.red("Error:"), error.message);
  } else if (error instanceof Context7Error) {
    console.error(chalk.red("Context7 Error:"), error.message);
  } else if (error instanceof PDIError) {
    console.error(chalk.red("Error:"), error.message);
  } else if (error instanceof Error) {
    console.error(chalk.red("Error:"), error.message);
    if (error.cause instanceof Error) {
      console.error(chalk.dim(`  Caused by: ${error.cause.message}`));
    }
  } else {
    console.error(chalk.red("Error:"), String(error));
  }

  // Show hint for all PDIError subclasses
  if (error instanceof PDIError && error.hint) {
    console.error(chalk.dim(`\nFix: ${error.hint}`));
  }

  // Show stack trace in debug mode
  if (process.env.PDI_DEBUG && error instanceof Error && error.stack) {
    console.error(chalk.dim("\nStack trace:"));
    console.error(chalk.dim(error.stack));
  }

  process.exit(1);
}
