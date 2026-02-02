#!/usr/bin/env node
/**
 * PDI CLI - Passive Docs Index
 * A tool for managing passive documentation indices for AI coding assistants
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { statusCommand } from './commands/status.js';
import { syncCommand } from './commands/sync.js';
import { cleanCommand } from './commands/clean.js';
import { listTemplates } from './lib/templates.js';

const program = new Command();

program
  .name('pdi')
  .description('Passive Docs Index - Documentation management for AI coding assistants')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize PDI in the current project')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('--no-detect', 'Skip dependency detection')
  .option('--internal', 'Also create internal patterns structure')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Add command
program
  .command('add')
  .description('Add documentation for frameworks')
  .argument('<frameworks...>', 'Framework names to add (e.g., hono drizzle zod)')
  .option('-v, --version <version>', 'Specify version (e.g., 4.x)')
  .option('--minimal', 'Download only essential docs')
  .option('-f, --force', 'Overwrite existing docs')
  .option('--no-index', 'Do not update CLAUDE.md index')
  .action(async (frameworks, options) => {
    try {
      await addCommand(frameworks, options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Synchronize docs with package.json dependencies')
  .option('-y, --yes', 'Accept all changes without prompting')
  .option('--check', 'Only check for changes, do not apply')
  .option('--prune', 'Remove docs for uninstalled packages')
  .action(async (options) => {
    try {
      await syncCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show current PDI status')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Clean command
program
  .command('clean')
  .description('Remove orphan docs and optimize index')
  .option('-y, --yes', 'Remove without prompting')
  .option('--dry-run', 'Show what would be removed without doing it')
  .action(async (options) => {
    try {
      await cleanCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List available framework templates')
  .option('--category <category>', 'Filter by category')
  .action((options) => {
    const templates = listTemplates();

    console.log(chalk.bold('\nAvailable Framework Templates'));
    console.log(chalk.dim('═'.repeat(40)));
    console.log('');

    const categories = new Map<string, typeof templates>();

    for (const template of templates) {
      if (options.category && template.category !== options.category) continue;

      const cat = categories.get(template.category) || [];
      cat.push(template);
      categories.set(template.category, cat);
    }

    for (const [category, temps] of categories) {
      console.log(chalk.bold(category.charAt(0).toUpperCase() + category.slice(1) + ':'));

      for (const t of temps) {
        const priority = t.priority === 'P0' ? chalk.green('●') : t.priority === 'P1' ? chalk.yellow('●') : chalk.dim('●');
        console.log(`  ${priority} ${t.name.padEnd(16)} ${chalk.dim(t.version.padEnd(6))} ${t.displayName}`);
      }
      console.log('');
    }

    console.log(chalk.dim('Priority: ● P0 (essential)  ● P1 (recommended)  ● P2 (optional)'));
    console.log('');
  });

// Update command (placeholder)
program
  .command('update')
  .description('Update docs to latest versions')
  .argument('[frameworks...]', 'Specific frameworks to update')
  .action(async (frameworks) => {
    console.log(chalk.yellow('Update command coming soon.'));
    console.log(chalk.dim('For now, use: pdi add --force <framework>'));
  });

// Generate internal command (placeholder)
program
  .command('generate')
  .description('Generate internal pattern documentation')
  .argument('<type>', 'Type of docs to generate (internal)')
  .option('--category <category>', 'Specific category to generate')
  .option('--dry-run', 'Show what would be generated')
  .option('--ai', 'Use AI to enhance descriptions')
  .action(async (type, options) => {
    if (type !== 'internal') {
      console.log(chalk.red(`Unknown type: ${type}`));
      console.log(chalk.dim('Available: internal'));
      return;
    }

    console.log(chalk.yellow('Generate internal command coming soon.'));
    console.log(chalk.dim('This will analyze your codebase and generate pattern documentation.'));
  });

// Parse and run
program.parse();
