#!/usr/bin/env node

import { error, bold, dim, green, cyan, getVersion, printHeader } from '../lib/utils/ui.js';

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      flags[key] = val ?? true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function showHelp() {
  printHeader();
  console.log(`  ${bold('Usage:')} serpentstack <command> [options]

  ${bold(green('Stack commands'))} ${dim('(new projects)')}
    ${cyan('stack new')} <name>              Scaffold a new project from the template
    ${cyan('stack update')}                  Update template-level files to latest

  ${bold(green('Skills commands'))} ${dim('(any project)')}
    ${cyan('skills init')}                   Download base skills + persistent agent configs
    ${cyan('skills update')}                 Update base skills to latest versions
    ${cyan('skills persistent')}             Guided setup: configure + install + start all agents
    ${cyan('skills persistent')} --stop      Stop all running agents

  ${bold('Options:')}
    --force                       Overwrite existing files
    --all                         Include new files in updates (skills update)
    --version                     Show version
    --help                        Show this help

  ${dim('Examples:')}
    ${dim('$')} serpentstack stack new my-saas-app
    ${dim('$')} serpentstack skills init
    ${dim('$')} serpentstack skills persistent
    ${dim('$')} serpentstack skills persistent --stop

  ${dim('Docs: https://github.com/Benja-Pauls/SerpentStack')}
`);
}

async function main() {
  const [,, noun, verb, ...rest] = process.argv;
  const { flags, positional } = parseFlags(rest);

  // Top-level flags
  if (noun === '--version' || flags.version) {
    console.log(getVersion());
    return;
  }
  if (!noun || noun === '--help' || flags.help) {
    showHelp();
    return;
  }

  if (noun === 'stack') {
    if (verb === 'new') {
      const { stackNew } = await import('../lib/commands/stack-new.js');
      await stackNew(positional[0]);
    } else if (verb === 'update') {
      const { stackUpdate } = await import('../lib/commands/stack-update.js');
      await stackUpdate({ force: !!flags.force });
    } else {
      error(`Unknown stack command: ${verb}`);
      console.log(`\n  Available: ${bold('stack new <name>')}, ${bold('stack update')}\n`);
      process.exit(1);
    }
  } else if (noun === 'skills') {
    if (verb === 'init') {
      const { skillsInit } = await import('../lib/commands/skills-init.js');
      await skillsInit({ force: !!flags.force });
    } else if (verb === 'update') {
      const { skillsUpdate } = await import('../lib/commands/skills-update.js');
      await skillsUpdate({ force: !!flags.force, all: !!flags.all });
    } else if (verb === 'persistent') {
      const { skillsPersistent } = await import('../lib/commands/skills-persistent.js');
      await skillsPersistent({ stop: !!flags.stop });
    } else {
      error(`Unknown skills command: ${verb}`);
      console.log(`\n  Available: ${bold('skills init')}, ${bold('skills update')}, ${bold('skills persistent')}\n`);
      process.exit(1);
    }
  } else {
    error(`Unknown command: ${bold(noun)}`);
    console.log(`\n  Run ${bold('serpentstack --help')} to see available commands.\n`);
    process.exit(1);
  }
}

// Global error handling
process.on('unhandledRejection', (err) => {
  error(err.message || 'An unexpected error occurred');
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});

main().catch((err) => {
  error(err.message || 'An unexpected error occurred');
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
