/**
 * PDI Auth Command
 * Configure Context7 API key interactively
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { checkAvailability } from '../lib/context7-client.js';

const CONFIG_DIR = join(homedir(), '.config', 'pdi');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface GlobalConfig {
  apiKey?: string;
  configuredAt?: string;
}

async function readGlobalConfig(): Promise<GlobalConfig> {
  if (!existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeGlobalConfig(config: GlobalConfig): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export interface AuthOptions {
  status?: boolean;
  logout?: boolean;
}

export async function authCommand(options: AuthOptions): Promise<void> {
  const spinner = ora();

  // Show status
  if (options.status) {
    spinner.start('Checking authentication status...');
    const availability = await checkAvailability();

    if (availability.http) {
      spinner.succeed(chalk.green('Authenticated via CONTEXT7_API_KEY'));
      console.log(chalk.dim('  API key is set in environment'));
    } else {
      const config = await readGlobalConfig();
      if (config.apiKey) {
        spinner.succeed(chalk.yellow('API key saved but not loaded'));
        console.log(chalk.dim('  Add to your shell profile:'));
        console.log(chalk.dim(`  export CONTEXT7_API_KEY="${config.apiKey}"`));
      } else {
        spinner.info('Not authenticated');
        console.log(chalk.dim('  Run: pdi auth'));
      }
    }

    if (availability.mcp) {
      console.log(chalk.dim('  MCP fallback: available (Claude Code session detected)'));
    }
    return;
  }

  // Logout
  if (options.logout) {
    const config = await readGlobalConfig();
    if (config.apiKey) {
      delete config.apiKey;
      delete config.configuredAt;
      await writeGlobalConfig(config);
      console.log(chalk.green('✓ API key removed from config'));
      console.log(chalk.dim('  Note: Also unset CONTEXT7_API_KEY from your environment if set'));
    } else {
      console.log(chalk.dim('No API key configured'));
    }
    return;
  }

  // Interactive login
  console.log(chalk.bold('\nContext7 Authentication\n'));
  console.log(chalk.dim('Context7 provides up-to-date documentation for frameworks.'));
  console.log(chalk.dim('Get your free API key at: https://context7.com\n'));

  // Check if already authenticated
  const availability = await checkAvailability();
  if (availability.http) {
    const response = await prompts({
      type: 'confirm',
      name: 'reconfigure',
      message: 'Already authenticated. Reconfigure?',
      initial: false,
    });

    if (!response.reconfigure) {
      return;
    }
  }

  // Get API key
  const response = await prompts([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Context7 API key:',
      validate: (value) => {
        if (!value) return 'API key is required';
        if (!value.startsWith('ctx7')) return 'Invalid API key format (should start with ctx7)';
        return true;
      },
    },
    {
      type: 'select',
      name: 'saveMethod',
      message: 'How do you want to save the API key?',
      choices: [
        {
          title: 'Save to config + show export (recommended)',
          description: 'Saves to ~/.config/pdi and shows export command',
          value: 'both',
        },
        {
          title: 'Save to ~/.config/pdi/config.json only',
          description: 'PDI will auto-load from this file',
          value: 'file',
        },
        {
          title: 'Show export command only',
          description: 'Manual: add to shell profile, no auto-load',
          value: 'show',
        },
      ],
      initial: 0,
    },
  ]);

  if (!response.apiKey) {
    console.log(chalk.dim('Cancelled'));
    return;
  }

  // Validate API key
  spinner.start('Validating API key...');
  process.env.CONTEXT7_API_KEY = response.apiKey;

  // Reset client cache to pick up new key
  const { resetClients } = await import('../lib/context7-client.js');
  resetClients();

  const newAvailability = await checkAvailability();

  if (!newAvailability.http) {
    spinner.fail('Invalid API key');
    delete process.env.CONTEXT7_API_KEY;
    return;
  }

  spinner.succeed('API key validated');

  // Save based on method
  if (response.saveMethod === 'file' || response.saveMethod === 'both') {
    const config = await readGlobalConfig();
    config.apiKey = response.apiKey;
    config.configuredAt = new Date().toISOString();
    await writeGlobalConfig(config);
    console.log(chalk.green(`✓ Saved to ${CONFIG_FILE}`));
  }

  if (response.saveMethod === 'show' || response.saveMethod === 'both') {
    console.log('');
    console.log(chalk.bold('Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):'));
    console.log('');
    console.log(chalk.cyan(`  export CONTEXT7_API_KEY="${response.apiKey}"`));
    console.log('');
    console.log(chalk.dim('Then reload your shell or run:'));
    console.log(chalk.dim(`  source ~/.zshrc  # or ~/.bashrc`));
  }

  console.log('');
  console.log(chalk.green('✓ Authentication configured!'));
  console.log(chalk.dim('  Run: pdi add <framework>'));
}

/**
 * Load API key from global config if not in environment
 */
export async function loadApiKeyFromConfig(): Promise<void> {
  if (process.env.CONTEXT7_API_KEY) {
    return; // Already set
  }

  const config = await readGlobalConfig();
  if (config.apiKey) {
    process.env.CONTEXT7_API_KEY = config.apiKey;
  }
}
