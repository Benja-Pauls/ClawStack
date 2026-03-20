#!/usr/bin/env node

import { error, bold, getVersion, printHeader } from '../lib/utils/ui.js';

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

  ${bold('Stack commands')} (new projects):
    stack new <name>              Scaffold a new project from the template
    stack update                  Update template-level files to latest

  ${bold('Skills commands')} (any project):
    skills init                   Download base skills + persistent agent configs
    skills update                 Update base skills to latest versions
    skills persistent --create    Set up OpenClaw workspace for your project
    skills persistent --start     Install OpenClaw (if needed) and start agent
    skills persistent --stop      Stop the background agent

  ${bold('Options:')}
    --force                       Overwrite existing files
    --all                         Include new files in updates (skills update)
    --version                     Show version
    --help                        Show this help
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
      await skillsPersistent({
        create: !!flags.create,
        start: !!flags.start,
        stop: !!flags.stop,
      });
    } else {
      error(`Unknown skills command: ${verb}`);
      console.log(`\n  Available: ${bold('skills init')}, ${bold('skills update')}, ${bold('skills persistent')}\n`);
      process.exit(1);
    }
  } else {
    error(`Unknown command: ${noun}`);
    showHelp();
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
