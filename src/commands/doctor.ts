/**
 * PDI Doctor Command
 * Diagnose configuration and provide recommendations
 */

import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { checkAvailability } from '../lib/context7-client.js';
import { configExists, readConfig, readPackageJson, detectDependencies } from '../lib/config.js';
import { hasTemplate, listTemplates } from '../lib/templates.js';
import { CLAUDE_DOCS_DIR } from '../lib/constants.js';

interface DiagnosticResult {
  name: string;
  status: 'ok' | 'warn' | 'error' | 'info';
  message: string;
  hint?: string;
}

export async function doctorCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const spinner = ora();
  const results: DiagnosticResult[] = [];

  console.log(chalk.bold('\nPDI Doctor - Diagnostic Report\n'));
  console.log(chalk.dim('═'.repeat(50)));

  // 1. Check Context7 authentication
  spinner.start('Checking Context7 authentication...');
  const availability = await checkAvailability();

  if (availability.http) {
    results.push({
      name: 'Context7 API',
      status: 'ok',
      message: 'Authenticated via HTTP API',
    });
    spinner.succeed('Context7 API: ' + chalk.green('authenticated'));
  } else if (availability.mcp) {
    results.push({
      name: 'Context7 API',
      status: 'warn',
      message: 'MCP only (works inside Claude Code sessions)',
      hint: 'Run: pdi auth (for standalone use outside Claude Code)',
    });
    spinner.warn('Context7 API: ' + chalk.yellow('MCP only'));
  } else {
    results.push({
      name: 'Context7 API',
      status: 'error',
      message: 'Not authenticated',
      hint: 'Run: pdi auth',
    });
    spinner.fail('Context7 API: ' + chalk.red('not configured'));
  }

  // 2. Check PDI initialization
  spinner.start('Checking PDI initialization...');
  const isInitialized = await configExists(projectRoot);

  if (isInitialized) {
    results.push({
      name: 'PDI Init',
      status: 'ok',
      message: 'Project initialized',
    });
    spinner.succeed('PDI Init: ' + chalk.green('initialized'));
  } else {
    results.push({
      name: 'PDI Init',
      status: 'error',
      message: 'Project not initialized',
      hint: 'Run: pdi init',
    });
    spinner.fail('PDI Init: ' + chalk.red('not initialized'));
  }

  // 3. Check package.json
  spinner.start('Checking package.json...');
  const packageJson = await readPackageJson(projectRoot);

  if (packageJson) {
    results.push({
      name: 'package.json',
      status: 'ok',
      message: `Found: ${packageJson.name || 'unnamed'}`,
    });
    spinner.succeed('package.json: ' + chalk.green('found'));

    // 4. Check for detectable frameworks
    const detected = detectDependencies(packageJson);
    const withTemplates = detected.filter((d) => hasTemplate(d.framework?.name || ''));

    if (withTemplates.length > 0) {
      results.push({
        name: 'Frameworks',
        status: 'info',
        message: `${withTemplates.length} framework(s) with docs available`,
        hint: withTemplates.map((d) => d.framework?.name).join(', '),
      });
    }
  } else {
    results.push({
      name: 'package.json',
      status: 'warn',
      message: 'Not found',
      hint: 'PDI works best in Node.js projects',
    });
    spinner.warn('package.json: ' + chalk.yellow('not found'));
  }

  // 5. Check installed docs
  if (isInitialized) {
    spinner.start('Checking installed docs...');
    const config = await readConfig(projectRoot);

    if (config) {
      const frameworkCount = Object.keys(config.frameworks).length;
      const totalFiles = Object.values(config.frameworks).reduce((sum, fw) => sum + fw.files, 0);

      if (frameworkCount > 0) {
        results.push({
          name: 'Docs',
          status: 'ok',
          message: `${frameworkCount} framework(s), ${totalFiles} files`,
        });
        spinner.succeed('Docs: ' + chalk.green(`${frameworkCount} framework(s)`));

        // Check for outdated docs
        const outdated = Object.entries(config.frameworks).filter(([, fw]) => {
          if (!fw.lastUpdate) return true;
          const lastUpdate = new Date(fw.lastUpdate);
          const daysSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSince > 30;
        });

        if (outdated.length > 0) {
          results.push({
            name: 'Docs Age',
            status: 'warn',
            message: `${outdated.length} framework(s) may be outdated`,
            hint: 'Run: pdi update',
          });
        }
      } else {
        results.push({
          name: 'Docs',
          status: 'warn',
          message: 'No docs installed',
          hint: 'Run: pdi add <framework>',
        });
        spinner.warn('Docs: ' + chalk.yellow('none installed'));
      }
    }
  }

  // 6. Check CLAUDE.md
  spinner.start('Checking CLAUDE.md...');
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');

  if (existsSync(claudeMdPath)) {
    results.push({
      name: 'CLAUDE.md',
      status: 'ok',
      message: 'Found with docs index',
    });
    spinner.succeed('CLAUDE.md: ' + chalk.green('found'));
  } else if (isInitialized) {
    results.push({
      name: 'CLAUDE.md',
      status: 'warn',
      message: 'Not found',
      hint: 'Will be created when you add docs',
    });
    spinner.warn('CLAUDE.md: ' + chalk.yellow('not found'));
  }

  // 7. Check global config
  const globalConfigPath = join(homedir(), '.config', 'pdi', 'config.json');
  if (existsSync(globalConfigPath)) {
    results.push({
      name: 'Global Config',
      status: 'info',
      message: 'Found at ~/.config/pdi/config.json',
    });
  }

  // Summary
  console.log('');
  console.log(chalk.dim('═'.repeat(50)));
  console.log(chalk.bold('\nSummary\n'));

  const errors = results.filter((r) => r.status === 'error');
  const warnings = results.filter((r) => r.status === 'warn');

  if (errors.length === 0 && warnings.length === 0) {
    console.log(chalk.green('✓ All checks passed!'));
  } else {
    if (errors.length > 0) {
      console.log(chalk.red(`✗ ${errors.length} error(s) found:`));
      for (const error of errors) {
        console.log(chalk.red(`  • ${error.name}: ${error.message}`));
        if (error.hint) {
          console.log(chalk.dim(`    → ${error.hint}`));
        }
      }
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow(`⚠ ${warnings.length} warning(s):`));
      for (const warning of warnings) {
        console.log(chalk.yellow(`  • ${warning.name}: ${warning.message}`));
        if (warning.hint) {
          console.log(chalk.dim(`    → ${warning.hint}`));
        }
      }
    }
  }

  // Recommendations
  console.log('');
  console.log(chalk.bold('Recommended Actions:\n'));

  if (!availability.http && !availability.mcp) {
    console.log(chalk.cyan('  1. pdi auth          # Configure Context7 API key'));
  }

  if (!isInitialized) {
    console.log(chalk.cyan('  2. pdi init          # Initialize PDI in this project'));
  }

  if (isInitialized && packageJson) {
    const detected = detectDependencies(packageJson);
    const config = await readConfig(projectRoot);
    const notInstalled = detected.filter(
      (d) => d.framework && hasTemplate(d.framework.name) && !config?.frameworks[d.framework.name]
    );

    if (notInstalled.length > 0) {
      const names = notInstalled.map((d) => d.framework?.name).join(' ');
      console.log(chalk.cyan(`  3. pdi add ${names}  # Add detected frameworks`));
    }
  }

  console.log(chalk.cyan('  4. pdi status        # Check current status'));
  console.log('');
}
