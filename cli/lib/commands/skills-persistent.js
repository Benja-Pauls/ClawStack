import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { info, success, warn, error, confirm, bold, dim } from '../utils/ui.js';

function which(cmd) {
  return new Promise((resolve) => {
    execFile('which', [cmd], (err) => resolve(!err));
  });
}

function checkOpenClawWorkspace() {
  const dir = join(process.cwd(), '.openclaw');
  const required = ['SOUL.md', 'HEARTBEAT.md', 'AGENTS.md'];
  if (!existsSync(dir)) return false;
  return required.every((f) => existsSync(join(dir, f)));
}

async function persistentCreate() {
  if (!checkOpenClawWorkspace()) {
    error('No .openclaw/ workspace found. Run `serpentstack skills init` first.');
    process.exit(1);
  }

  info('Customizing OpenClaw workspace for your project...');
  console.log();

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const name = await rl.question(`  Project name: `);
    const lang = await rl.question(`  Primary language ${dim('(e.g., Python, TypeScript)')}: `);
    const framework = await rl.question(`  Framework ${dim('(e.g., FastAPI, Next.js, Django)')}: `);
    const conventions = await rl.question(`  Key conventions ${dim('(brief, e.g., "services flush, routes commit")')}: `);

    console.log();

    // Read and update SOUL.md with project-specific info
    const { readFileSync, writeFileSync } = await import('node:fs');
    const soulPath = join(process.cwd(), '.openclaw/SOUL.md');
    let soul = readFileSync(soulPath, 'utf8');

    // Prepend project-specific context
    const projectContext = [
      `# ${name} — Persistent Development Agent`,
      '',
      `**Project:** ${name}`,
      `**Language:** ${lang}`,
      `**Framework:** ${framework}`,
      `**Conventions:** ${conventions}`,
      '',
      '---',
      '',
    ].join('\n');

    // Replace the first heading and everything before the first ---
    const dashIndex = soul.indexOf('---');
    if (dashIndex !== -1) {
      soul = projectContext + soul.slice(dashIndex + 3).trimStart();
    } else {
      soul = projectContext + soul;
    }

    writeFileSync(soulPath, soul, 'utf8');
    success(`Updated .openclaw/SOUL.md with ${bold(name)} project context`);
    info(`Review and customize .openclaw/ files, then run: ${bold('serpentstack skills persistent --start')}`);
  } finally {
    rl.close();
  }
  console.log();
}

async function persistentStart() {
  if (!checkOpenClawWorkspace()) {
    error('No .openclaw/ workspace found. Run `serpentstack skills init` first.');
    process.exit(1);
  }

  const hasOpenClaw = await which('openclaw');
  if (!hasOpenClaw) {
    warn('OpenClaw is not installed.');
    const install = await confirm('Install OpenClaw now? (npm install -g openclaw@latest)');
    if (!install) {
      info(`Install manually: ${bold('npm install -g openclaw@latest')}`);
      return;
    }
    info('Installing OpenClaw...');
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['install', '-g', 'openclaw@latest'], { stdio: 'inherit' });
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`npm install exited with code ${code}`)));
    });
    success('OpenClaw installed');
    console.log();
  }

  info('Starting persistent agent...');
  const child = spawn('openclaw', ['start', '--workspace', '.openclaw/'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  child.on('error', (err) => {
    error(`Failed to start OpenClaw: ${err.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      error(`OpenClaw exited with code ${code}`);
      process.exit(code);
    }
  });
}

async function persistentStop() {
  const hasOpenClaw = await which('openclaw');
  if (!hasOpenClaw) {
    error('OpenClaw is not installed. Nothing to stop.');
    return;
  }

  info('Stopping persistent agent...');
  await new Promise((resolve, reject) => {
    execFile('openclaw', ['stop'], (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve();
      }
    });
  });
  success('Persistent agent stopped');
}

export async function skillsPersistent({ create = false, start = false, stop = false } = {}) {
  if (create) return persistentCreate();
  if (start) return persistentStart();
  if (stop) return persistentStop();

  error('Specify an action: --create, --start, or --stop');
  console.log();
  console.log(`  ${bold('serpentstack skills persistent --create')}  Set up the workspace`);
  console.log(`  ${bold('serpentstack skills persistent --start')}   Start the background agent`);
  console.log(`  ${bold('serpentstack skills persistent --stop')}    Stop the background agent`);
  console.log();
  process.exit(1);
}
