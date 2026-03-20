import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { info, success, warn, error, confirm, bold, dim, green, cyan, yellow, printBox, printHeader } from '../utils/ui.js';
import {
  parseAgentMd,
  discoverAgents,
  generateWorkspace,
  writePid,
  readPid,
  removePid,
  listPids,
  isProcessAlive,
  cleanStalePids,
  cleanWorkspace,
} from '../utils/agent-utils.js';

function which(cmd) {
  return new Promise((resolve) => {
    execFile('which', [cmd], (err) => resolve(!err));
  });
}

async function askQuestion(rl, label, hint) {
  const answer = await rl.question(`  ${green('?')} ${bold(label)}${hint ? ` ${dim(hint)}` : ''}: `);
  return answer.trim();
}

// ─── Stop Flow ──────────────────────────────────────────────

async function stopAllAgents(projectDir) {
  cleanStalePids(projectDir);
  const running = listPids(projectDir);

  if (running.length === 0) {
    info('No agents are currently running.');
    console.log();
    return;
  }

  console.log(`  ${dim('Stopping')} ${bold(String(running.length))} ${dim('agent(s)...')}`);
  console.log();

  let stopped = 0;
  for (const { name, pid } of running) {
    try {
      process.kill(pid, 'SIGTERM');
      removePid(projectDir, name);
      cleanWorkspace(projectDir, name);
      success(`${bold(name)} stopped ${dim(`(PID ${pid})`)}`);
      stopped++;
    } catch (err) {
      if (err.code === 'ESRCH') {
        // Process already dead
        removePid(projectDir, name);
        success(`${bold(name)} already stopped`);
        stopped++;
      } else {
        error(`Failed to stop ${bold(name)}: ${err.message}`);
      }
    }
  }

  console.log();
  success(`${green(String(stopped))} agent(s) stopped`);
  console.log();
}

// ─── Customize Workspace ────────────────────────────────────

async function customizeWorkspace(projectDir) {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log();
  console.log(`  ${bold('Configure your project identity')}`);
  console.log(`  ${dim('Answer a few questions so all agents understand your project.')}`);
  console.log();

  try {
    const name = await askQuestion(rl, 'Project name', '(e.g., Acme API)');
    const lang = await askQuestion(rl, 'Primary language', '(e.g., Python, TypeScript)');
    const framework = await askQuestion(rl, 'Framework', '(e.g., FastAPI, Next.js, Django)');
    const devCmd = await askQuestion(rl, 'Dev server command', '(e.g., make dev, npm run dev)');
    const testCmd = await askQuestion(rl, 'Test command', '(e.g., make test, pytest, npm test)');
    const conventions = await askQuestion(rl, 'Key conventions', '(brief, e.g., "services flush, routes commit")');

    console.log();

    const soulPath = join(projectDir, '.openclaw/SOUL.md');
    let soul = readFileSync(soulPath, 'utf8');

    const projectContext = [
      `# ${name} — Persistent Development Agents`,
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

    return true;
  } finally {
    rl.close();
  }
}

// ─── Install OpenClaw ───────────────────────────────────────

async function installOpenClaw() {
  console.log();
  warn('OpenClaw is not installed.');
  console.log();
  console.log(`  ${dim('OpenClaw is the persistent agent runtime. Each agent in')}`);
  console.log(`  ${dim('.openclaw/agents/ runs as a separate OpenClaw process.')}`);
  console.log();

  const install = await confirm('Install OpenClaw now? (npm install -g openclaw@latest)');
  if (!install) {
    console.log();
    info('Install manually when ready:');
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

// ─── Start Agents ───────────────────────────────────────────

function startAgent(projectDir, agentName, workspacePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('openclaw', ['start', '--workspace', workspacePath], {
      stdio: 'ignore',
      detached: true,
      cwd: projectDir,
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: join(workspacePath, '.state'),
      },
    });

    child.unref();

    child.on('error', (err) => {
      reject(new Error(`Failed to start ${agentName}: ${err.message}`));
    });

    // Give it a moment to start, then record PID
    setTimeout(() => {
      writePid(projectDir, agentName, child.pid);
      resolve(child.pid);
    }, 500);
  });
}

// ─── Main Flow ──────────────────────────────────────────────

export async function skillsPersistent({ stop = false } = {}) {
  const projectDir = process.cwd();

  // --stop flag
  if (stop) {
    printHeader();
    await stopAllAgents(projectDir);
    return;
  }

  // === Guided setup flow ===
  printHeader();

  // Step 1: Check workspace
  console.log(`  ${bold('Step 1/4')} ${dim('\u2014 Check workspace')}`);
  console.log();

  const soulPath = join(projectDir, '.openclaw/SOUL.md');
  if (!existsSync(soulPath)) {
    error('No .openclaw/ workspace found.');
    console.log();
    console.log(`  Run ${bold('serpentstack skills init')} first to download the workspace files.`);
    console.log();
    process.exit(1);
  }
  success('.openclaw/SOUL.md found');

  const agents = discoverAgents(projectDir);
  if (agents.length === 0) {
    error('No agents found in .openclaw/agents/');
    console.log();
    console.log(`  Run ${bold('serpentstack skills init')} to download the default agents,`);
    console.log(`  or create your own at ${bold('.openclaw/agents/<name>/AGENT.md')}`);
    console.log();
    process.exit(1);
  }
  success(`${green(String(agents.length))} agent(s) found in .openclaw/agents/`);
  console.log();

  // Clean up any stale PIDs from previous runs
  cleanStalePids(projectDir);

  // Check if any agents are already running
  const alreadyRunning = listPids(projectDir);
  if (alreadyRunning.length > 0) {
    warn(`${bold(String(alreadyRunning.length))} agent(s) already running`);
    for (const { name, pid } of alreadyRunning) {
      console.log(`  ${dim('\u2022')} ${bold(name)} ${dim(`(PID ${pid})`)}`);
    }
    console.log();
    const restart = await confirm('Stop running agents and restart?');
    if (restart) {
      await stopAllAgents(projectDir);
    } else {
      console.log();
      info('Keeping existing agents running.');
      console.log();
      return;
    }
  }

  // Step 2: Configure project identity
  console.log(`  ${bold('Step 2/4')} ${dim('\u2014 Configure project identity')}`);

  const soulContent = readFileSync(soulPath, 'utf8');
  const isCustomized = !soulContent.startsWith('# SerpentStack') && !soulContent.includes('{{PROJECT_NAME}}');

  if (isCustomized) {
    console.log();
    success('SOUL.md already customized');
    console.log();
    const reconfigure = await confirm('Reconfigure? (will overwrite current settings)');
    if (reconfigure) {
      await customizeWorkspace(projectDir);
    }
    console.log();
  } else {
    await customizeWorkspace(projectDir);
    console.log();
  }

  // Step 3: Select agents
  console.log(`  ${bold('Step 3/4')} ${dim('\u2014 Review agents')}`);
  console.log();

  // Parse all agents and display them
  const parsed = [];
  for (const agent of agents) {
    try {
      const agentMd = parseAgentMd(agent.agentMdPath);
      parsed.push({ ...agent, agentMd });

      const model = agentMd.meta.model || 'default';
      const modelShort = model.includes('haiku') ? 'Haiku' : model.includes('sonnet') ? 'Sonnet' : model.includes('opus') ? 'Opus' : model;
      const schedule = (agentMd.meta.schedule || []).map(s => s.every).join(', ');

      success(`${bold(agent.name)}  ${dim(agentMd.meta.description || '')}`);
      console.log(`    ${dim(`Model: ${modelShort}`)}${schedule ? dim(` \u2022 Schedule: ${schedule}`) : ''}`);
    } catch (err) {
      error(`${bold(agent.name)}: ${err.message}`);
    }
  }

  if (parsed.length === 0) {
    console.log();
    error('No valid agents found. Check your AGENT.md files.');
    console.log();
    process.exit(1);
  }

  console.log();
  console.log(`  ${dim(`${parsed.length} agent(s) will be started. Delete an agent's folder to disable it.`)}`);
  console.log();

  // Step 4: Install + start
  console.log(`  ${bold('Step 4/4')} ${dim('\u2014 Start agents')}`);

  const hasOpenClaw = await which('openclaw');
  if (!hasOpenClaw) {
    const installed = await installOpenClaw();
    if (!installed) return;
  } else {
    success('OpenClaw is installed');
  }

  const shouldStart = await confirm(`Start ${parsed.length} agent(s) now?`);
  if (!shouldStart) {
    console.log();
    printBox('Start later', [
      `${dim('$')} ${bold('serpentstack skills persistent')}         ${dim('# run setup again')}`,
      `${dim('$')} ${bold('serpentstack skills persistent --stop')}  ${dim('# stop all agents')}`,
    ]);
    return;
  }

  console.log();

  // Read shared SOUL.md
  const sharedSoul = readFileSync(soulPath, 'utf8');
  let started = 0;

  for (const { name, agentMd } of parsed) {
    try {
      const workspacePath = generateWorkspace(projectDir, name, agentMd, sharedSoul);
      const pid = await startAgent(projectDir, name, workspacePath);

      const model = agentMd.meta.model || 'default';
      const modelShort = model.includes('haiku') ? 'Haiku' : model.includes('sonnet') ? 'Sonnet' : model.includes('opus') ? 'Opus' : model;
      const schedule = (agentMd.meta.schedule || []).map(s => s.every).join(', ');

      success(`${bold(name)} started ${dim(`(${modelShort}, ${schedule || 'no schedule'}) PID ${pid}`)}`);
      started++;
    } catch (err) {
      error(`${bold(name)}: ${err.message}`);
    }
  }

  console.log();
  if (started > 0) {
    success(`${green(String(started))} agent(s) running`);
    console.log();
    printBox('Manage your agents', [
      `${dim('$')} ${bold('serpentstack skills persistent --stop')}  ${dim('# stop all agents')}`,
      `${dim('$')} ${bold('serpentstack skills persistent')}         ${dim('# restart / reconfigure')}`,
      '',
      `${dim('Add agents:')}   ${dim('Create .openclaw/agents/<name>/AGENT.md')}`,
      `${dim('Remove agents:')} ${dim('Delete the agent folder from .openclaw/agents/')}`,
      `${dim('Customize:')}     ${dim('Edit AGENT.md frontmatter (model, schedule, tools)')}`,
    ]);
  } else {
    error('No agents were started. Check the errors above.');
    console.log();
  }
}
