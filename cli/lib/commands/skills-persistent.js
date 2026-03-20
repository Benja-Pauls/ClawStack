import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { info, success, warn, error, confirm, bold, dim, green, cyan, printBox, printHeader } from '../utils/ui.js';

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

function checkSoulCustomized() {
  const soulPath = join(process.cwd(), '.openclaw/SOUL.md');
  if (!existsSync(soulPath)) return false;
  const { readFileSync } = require_fs();
  const content = readFileSync(soulPath, 'utf8');
  // If it still has the template placeholder, it's not customized
  return !content.includes('{{PROJECT_NAME}}') && !content.startsWith('# SerpentStack');
}

function require_fs() {
  // Lazy import to avoid top-level dynamic import
  return { readFileSync: existsSync ? (await_import()).readFileSync : null };
}

async function askQuestion(rl, label, hint) {
  const answer = await rl.question(`  ${green('?')} ${bold(label)}${hint ? ` ${dim(hint)}` : ''}: `);
  return answer.trim();
}

async function customizeWorkspace() {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log();
  console.log(`  ${bold('Configure your persistent agent')}`);
  console.log(`  ${dim("Answer a few questions so the agent understands your project.")}`);
  console.log();

  try {
    const name = await askQuestion(rl, 'Project name', '(e.g., Acme API)');
    const lang = await askQuestion(rl, 'Primary language', '(e.g., Python, TypeScript)');
    const framework = await askQuestion(rl, 'Framework', '(e.g., FastAPI, Next.js, Django)');
    const devCmd = await askQuestion(rl, 'Dev server command', '(e.g., make dev, npm run dev)');
    const testCmd = await askQuestion(rl, 'Test command', '(e.g., make test, pytest, npm test)');
    const conventions = await askQuestion(rl, 'Key conventions', '(brief, e.g., "services flush, routes commit")');

    console.log();

    // Read and update SOUL.md with project-specific info
    const { readFileSync, writeFileSync } = await import('node:fs');
    const soulPath = join(process.cwd(), '.openclaw/SOUL.md');
    let soul = readFileSync(soulPath, 'utf8');

    const projectContext = [
      `# ${name} — Persistent Development Agent`,
      '',
      `**Project:** ${name}`,
      `**Language:** ${lang}`,
      `**Framework:** ${framework}`,
      `**Dev server:** \`${devCmd}\``,
      `**Tests:** \`${testCmd}\``,
      `**Conventions:** ${conventions}`,
      '',
      '---',
      '',
    ].join('\n');

    const dashIndex = soul.indexOf('---');
    if (dashIndex !== -1) {
      soul = projectContext + soul.slice(dashIndex + 3).trimStart();
    } else {
      soul = projectContext + soul;
    }

    writeFileSync(soulPath, soul, 'utf8');
    success(`Updated ${bold('.openclaw/SOUL.md')} with ${green(name)} project context`);

    // Update HEARTBEAT.md with the actual dev/test commands
    const heartbeatPath = join(process.cwd(), '.openclaw/HEARTBEAT.md');
    if (existsSync(heartbeatPath)) {
      let heartbeat = readFileSync(heartbeatPath, 'utf8');
      // Replace placeholder commands if they exist
      heartbeat = heartbeat.replace(/make dev/g, devCmd);
      heartbeat = heartbeat.replace(/make test/g, testCmd);
      writeFileSync(heartbeatPath, heartbeat, 'utf8');
      success(`Updated ${bold('.openclaw/HEARTBEAT.md')} with your dev/test commands`);
    }

    return true;
  } finally {
    rl.close();
  }
}

async function installOpenClaw() {
  console.log();
  warn('OpenClaw is not installed.');
  console.log();
  console.log(`  ${dim('OpenClaw is the persistent agent runtime. It runs in the background,')}`);
  console.log(`  ${dim('watching your dev server and running health checks on a schedule.')}`);
  console.log();

  const install = await confirm('Install OpenClaw now? (npm install -g openclaw@latest)');
  if (!install) {
    console.log();
    info(`Install manually when ready:`);
    console.log(`  ${dim('$')} ${bold('npm install -g openclaw@latest')}`);
    console.log(`  ${dim('$')} ${bold('serpentstack skills persistent')}`);
    console.log();
    return false;
  }

  console.log();
  info('Installing OpenClaw...');
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['install', '-g', 'openclaw@latest'], { stdio: 'inherit' });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`npm install exited with code ${code}`)));
  });
  console.log();
  success('OpenClaw installed');
  return true;
}

async function startAgent() {
  console.log();
  info('Starting persistent agent...');
  console.log();
  console.log(`  ${dim('The agent will:')}`);
  console.log(`  ${dim('\u2022 Watch your dev server for errors')}`);
  console.log(`  ${dim('\u2022 Run tests on a schedule')}`);
  console.log(`  ${dim('\u2022 Flag when skills go stale')}`);
  console.log(`  ${dim('\u2022 Propose fixes with full context')}`);
  console.log();

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

export async function skillsPersistent({ stop = false } = {}) {
  // --stop is the only flag — everything else is a guided flow
  if (stop) {
    const hasOpenClaw = await which('openclaw');
    if (!hasOpenClaw) {
      error('OpenClaw is not installed. Nothing to stop.');
      return;
    }
    info('Stopping persistent agent...');
    await new Promise((resolve, reject) => {
      execFile('openclaw', ['stop'], (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      });
    });
    success('Persistent agent stopped');
    console.log();
    return;
  }

  // === Guided setup flow ===
  printHeader();

  // Step 1: Check for .openclaw/ workspace
  console.log(`  ${bold('Step 1/3')} ${dim('\u2014 Check workspace')}`);
  console.log();

  if (!checkOpenClawWorkspace()) {
    error('No .openclaw/ workspace found.');
    console.log();
    console.log(`  Run ${bold('serpentstack skills init')} first to download the workspace files.`);
    console.log();
    process.exit(1);
  }

  success('.openclaw/ workspace found');
  console.log();

  // Step 2: Customize if needed
  console.log(`  ${bold('Step 2/3')} ${dim('\u2014 Configure for your project')}`);

  // Check if SOUL.md looks like it has been customized
  const { readFileSync } = await import('node:fs');
  const soulPath = join(process.cwd(), '.openclaw/SOUL.md');
  const soulContent = readFileSync(soulPath, 'utf8');
  const isCustomized = !soulContent.startsWith('# SerpentStack') && !soulContent.includes('{{PROJECT_NAME}}');

  if (isCustomized) {
    console.log();
    success('Workspace already customized');
    console.log();

    const reconfigure = await confirm('Reconfigure? (will overwrite current settings)');
    if (reconfigure) {
      await customizeWorkspace();
    }
    console.log();
  } else {
    await customizeWorkspace();
    console.log();
  }

  // Step 3: Install OpenClaw + start
  console.log(`  ${bold('Step 3/3')} ${dim('\u2014 Start the agent')}`);

  const hasOpenClaw = await which('openclaw');
  if (!hasOpenClaw) {
    const installed = await installOpenClaw();
    if (!installed) return;
  } else {
    success('OpenClaw is installed');
  }

  const shouldStart = await confirm('Start the persistent agent now?');
  if (!shouldStart) {
    console.log();
    printBox('Start later', [
      `${dim('$')} ${bold('serpentstack skills persistent')}    ${dim('# run setup again')}`,
      `${dim('$')} ${bold('openclaw start --workspace .openclaw/')}  ${dim('# start directly')}`,
      '',
      `${dim('To stop:')}`,
      `${dim('$')} ${bold('serpentstack skills persistent --stop')}`,
    ]);
    return;
  }

  await startAgent();
}
