import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { info, success, warn, error, bold, dim, green, cyan, yellow, red, divider, printBox, printHeader } from '../utils/ui.js';
import {
  parseAgentMd,
  discoverAgents,
  generateWorkspace,
  writePid,
  removePid,
  listPids,
  cleanStalePids,
  cleanWorkspace,
  isProcessAlive,
} from '../utils/agent-utils.js';
import {
  readConfig,
  writeConfig,
  detectProjectDefaults,
  detectTemplateDefaults,
  getEffectiveModel,
  isAgentEnabled,
} from '../utils/config.js';
import { detectModels, modelShortName } from '../utils/models.js';

// ─── Helpers ────────────────────────────────────────────────

function which(cmd) {
  return new Promise((resolve) => {
    execFile('which', [cmd], (err) => resolve(!err));
  });
}

async function ask(rl, label, defaultValue) {
  const hint = defaultValue ? ` ${dim(`[${defaultValue}]`)}` : '';
  const answer = await rl.question(`  ${green('?')} ${bold(label)}${hint}: `);
  return answer.trim() || defaultValue || '';
}

async function askYesNo(rl, label, defaultYes = true) {
  const hint = defaultYes ? dim('[Y/n]') : dim('[y/N]');
  const answer = await rl.question(`  ${green('?')} ${label} ${hint} `);
  const val = answer.trim().toLowerCase();
  if (defaultYes) return val !== 'n' && val !== 'no';
  return val === 'y' || val === 'yes';
}

// ─── Model Picker ───────────────────────────────────────────

async function pickModel(rl, agentName, currentModel, available) {
  const choices = [];

  // Local models first (free, fast, recommended)
  if (available.local.length > 0) {
    console.log(`    ${dim('── Local')} ${green('free')} ${dim('──────────────────────')}`);
    for (const m of available.local) {
      const isCurrent = m.id === currentModel;
      const idx = choices.length;
      choices.push(m);
      const marker = isCurrent ? green('>') : ' ';
      const num = dim(`${idx + 1}.`);
      const label = isCurrent ? bold(m.name) : m.name;
      const params = m.params ? dim(` ${m.params}`) : '';
      const quant = m.quant ? dim(` ${m.quant}`) : '';
      const size = m.size ? dim(` (${m.size})`) : '';
      const tag = isCurrent ? green(' ← current') : '';
      console.log(`  ${marker} ${num} ${label}${params}${quant}${size}${tag}`);
    }
  }

  // Cloud models (require API key, cost money)
  if (available.cloud.length > 0) {
    const apiNote = available.hasApiKey ? green('key ✓') : yellow('needs API key');
    console.log(`    ${dim('── Cloud')} ${apiNote} ${dim('─────────────────────')}`);
    for (const m of available.cloud) {
      const isCurrent = m.id === currentModel;
      const idx = choices.length;
      choices.push(m);
      const marker = isCurrent ? green('>') : ' ';
      const num = dim(`${idx + 1}.`);
      const label = isCurrent ? bold(m.name) : m.name;
      const provider = m.provider ? dim(` (${m.provider})`) : '';
      const tag = isCurrent ? green(' ← current') : '';
      console.log(`  ${marker} ${num} ${label}${provider}${tag}`);
    }
  }

  // If current model isn't in either list, add it
  if (!choices.some(c => c.id === currentModel)) {
    choices.unshift({ id: currentModel, name: modelShortName(currentModel), tier: 'custom' });
    console.log(`    ${dim(`Current: ${modelShortName(currentModel)} (not in detected models)`)}`);
  }

  const currentIdx = choices.findIndex(c => c.id === currentModel);
  const defaultNum = currentIdx >= 0 ? currentIdx + 1 : 1;

  const answer = await rl.question(`    ${dim(`Enter 1-${choices.length}`)} ${dim(`[${defaultNum}]`)}: `);
  const idx = parseInt(answer.trim(), 10) - 1;

  const selected = (idx >= 0 && idx < choices.length) ? choices[idx] : choices[Math.max(0, currentIdx)];

  // Warn about cloud model costs
  if (selected.tier === 'cloud' && available.local.length > 0) {
    warn(`Cloud models cost tokens per heartbeat cycle. Consider a local model for persistent agents.`);
  }
  if (selected.tier === 'cloud' && !available.hasApiKey) {
    warn(`No API key detected. Run ${bold('openclaw configure')} to set up authentication.`);
  }

  return selected.id;
}

// ─── Terminal Spawning ──────────────────────────────────────

function openInTerminal(title, command, cwd) {
  const platform = process.platform;
  const termProgram = process.env.TERM_PROGRAM || '';
  const safeCwd = cwd.replace(/'/g, "'\\''").replace(/"/g, '\\"');
  const safeCmd = command.replace(/"/g, '\\"');

  if (platform === 'darwin') {
    if (termProgram === 'iTerm.app') {
      const script = `tell application "iTerm"
  tell current window
    create tab with default profile
    tell current session
      set name to "${title}"
      write text "cd '${safeCwd}' && ${safeCmd}"
    end tell
  end tell
end tell`;
      spawn('osascript', ['-e', script], { stdio: 'ignore', detached: true }).unref();
      return 'iTerm';
    }
    const script = `tell application "Terminal"
  activate
  do script "cd '${safeCwd}' && ${safeCmd}"
end tell`;
    spawn('osascript', ['-e', script], { stdio: 'ignore', detached: true }).unref();
    return 'Terminal';
  }

  if (platform === 'linux') {
    const shellCmd = `cd '${safeCwd}' && ${command}; exec bash`;
    const terminals = [
      ['gnome-terminal', ['--title', title, '--', 'bash', '-c', shellCmd]],
      ['kitty', ['--title', title, 'bash', '-c', shellCmd]],
      ['alacritty', ['--title', title, '-e', 'bash', '-c', shellCmd]],
      ['wezterm', ['start', '--', 'bash', '-c', shellCmd]],
      ['konsole', ['--new-tab', '-e', 'bash', '-c', shellCmd]],
      ['xterm', ['-title', title, '-e', 'bash', '-c', shellCmd]],
    ];
    for (const [bin, args] of terminals) {
      try {
        const child = spawn(bin, args, { stdio: 'ignore', detached: true });
        child.unref();
        const alive = child.pid && !child.killed;
        if (alive) return bin;
      } catch { continue; }
    }
  }

  if (platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', `"${title}"`, 'cmd', '/k', `cd /d "${cwd}" && ${command}`], {
      stdio: 'ignore', detached: true,
    }).unref();
    return 'cmd';
  }

  return null;
}

// ─── Stop Flow ──────────────────────────────────────────────

function stopAllAgents(projectDir) {
  cleanStalePids(projectDir);
  const running = listPids(projectDir);

  if (running.length === 0) {
    info('No agents are currently running.');
    console.log();
    return 0;
  }

  let stopped = 0;
  for (const { name, pid } of running) {
    try {
      process.kill(pid, 'SIGTERM');
      removePid(projectDir, name);
      cleanWorkspace(projectDir, name);
      success(`Stopped ${bold(name)} ${dim(`(PID ${pid})`)}`);
      stopped++;
    } catch (err) {
      if (err.code === 'ESRCH') {
        removePid(projectDir, name);
      } else {
        error(`Failed to stop ${bold(name)}: ${err.message}`);
      }
    }
  }

  if (stopped > 0) {
    console.log();
    success(`${stopped} agent(s) stopped`);
  }
  console.log();
  return stopped;
}

// ─── Agent Status ───────────────────────────────────────────

function getAgentStatus(projectDir, name, config) {
  const pid = listPids(projectDir).find(p => p.name === name);
  if (pid && isProcessAlive(pid.pid)) return { status: 'running', pid: pid.pid };
  if (!isAgentEnabled(name, config)) return { status: 'disabled', pid: null };
  return { status: 'stopped', pid: null };
}

function printAgentLine(name, agentMd, config, statusInfo) {
  const model = getEffectiveModel(name, agentMd.meta, config);
  const schedule = (agentMd.meta.schedule || []).map(s => s.every).join(', ');
  const modelStr = modelShortName(model);

  if (statusInfo.status === 'running') {
    console.log(`    ${green('●')} ${bold(name)}  ${dim(modelStr)}  ${dim(schedule)}  ${green(`PID ${statusInfo.pid}`)}`);
  } else if (statusInfo.status === 'disabled') {
    console.log(`    ${dim('○')} ${dim(name)}  ${dim(modelStr)}  ${dim(schedule)}  ${dim('disabled')}`);
  } else {
    console.log(`    ${yellow('○')} ${bold(name)}  ${dim(modelStr)}  ${dim(schedule)}  ${dim('ready')}`);
  }
}

function printStatusDashboard(config, parsed, projectDir) {
  console.log(`  ${bold(config.project.name)} ${dim(`— ${config.project.framework}`)}`);
  console.log(`  ${dim(`Dev: ${config.project.devCmd} · Test: ${config.project.testCmd}`)}`);
  console.log();

  for (const { name, agentMd } of parsed) {
    const statusInfo = getAgentStatus(projectDir, name, config);
    printAgentLine(name, agentMd, config, statusInfo);
  }
  console.log();
}

// ─── Configure Flow (project settings) ─────────────────────

async function runConfigure(projectDir, config, soulPath) {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const detected = detectProjectDefaults(projectDir);
    const template = detectTemplateDefaults(projectDir);
    const existing = config.project || {};
    const defaults = {
      name: existing.name || template?.name || detected.name,
      language: existing.language || template?.language || detected.language,
      framework: existing.framework || template?.framework || detected.framework,
      devCmd: existing.devCmd || template?.devCmd || detected.devCmd,
      testCmd: existing.testCmd || template?.testCmd || detected.testCmd,
      conventions: existing.conventions || template?.conventions || detected.conventions,
    };

    if (template && !existing.name) {
      info('Detected SerpentStack template — defaults pre-filled');
      console.log();
    }

    divider('Project');
    console.log(`  ${dim('Press Enter to keep defaults.')}`);
    console.log();

    config.project = {
      name: await ask(rl, 'Project name', defaults.name),
      language: await ask(rl, 'Primary language', defaults.language),
      framework: await ask(rl, 'Framework', defaults.framework),
      devCmd: await ask(rl, 'Dev server command', defaults.devCmd),
      testCmd: await ask(rl, 'Test command', defaults.testCmd),
      conventions: await ask(rl, 'Key conventions', defaults.conventions),
    };

    // Update SOUL.md with project context
    if (existsSync(soulPath)) {
      let soul = readFileSync(soulPath, 'utf8');
      const ctx = [
        `# ${config.project.name} — Persistent Development Agents`,
        '',
        `**Project:** ${config.project.name}`,
        `**Language:** ${config.project.language}`,
        `**Framework:** ${config.project.framework}`,
        `**Dev server:** \`${config.project.devCmd}\``,
        `**Tests:** \`${config.project.testCmd}\``,
        `**Conventions:** ${config.project.conventions}`,
        '', '---', '',
      ].join('\n');
      const dashIdx = soul.indexOf('---');
      soul = dashIdx !== -1 ? ctx + soul.slice(dashIdx + 3).trimStart() : ctx + soul;
      writeFileSync(soulPath, soul, 'utf8');
    }
    console.log();
    success(`Updated ${bold('.openclaw/SOUL.md')}`);
    console.log();
  } finally {
    rl.close();
  }

  // Mark as user-confirmed
  config._configured = true;
  writeConfig(projectDir, config);
  success(`Saved ${bold('.openclaw/config.json')}`);
  console.log();
}

// ─── Agents Flow (enable/disable + model selection) ─────────

async function runAgents(projectDir, config, parsed) {
  const available = await detectModels();

  if (available.local.length > 0) {
    info(`${available.local.length} local model(s) detected via Ollama`);
  } else {
    warn('No local models found. Install Ollama and pull a model for free persistent agents:');
    console.log(`  ${dim('$')} ${bold('ollama pull llama3.2')}`);
  }
  if (available.hasApiKey) {
    info('API key configured for cloud models');
  }
  console.log();

  divider('Agents');
  console.log(`  ${dim('Enable/disable each agent and pick a model.')}`);
  console.log();

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    for (const { name, agentMd } of parsed) {
      const existingAgent = config.agents?.[name];
      const currentEnabled = existingAgent?.enabled !== false;
      const currentModel = existingAgent?.model || 'ollama/llama3.2';
      const schedule = (agentMd.meta.schedule || []).map(s => s.every).join(', ');

      console.log(`  ${bold(name)}  ${dim(agentMd.meta.description || '')}`);
      console.log(`    ${dim(`Schedule: ${schedule || 'none'}`)}`);

      const enabled = await askYesNo(rl, `Enable ${bold(name)}?`, currentEnabled);

      let model = currentModel;
      if (enabled) {
        console.log();
        model = await pickModel(rl, name, currentModel, available);
      }

      config.agents[name] = { enabled, model };

      const status = enabled ? green('✓ enabled') : dim('✗ disabled');
      const modelLabel = enabled ? `, ${modelShortName(model)}` : '';
      console.log(`    ${status}${modelLabel}`);
      console.log();
    }
  } finally {
    rl.close();
  }

  config._configured = true;
  writeConfig(projectDir, config);
  success(`Saved ${bold('.openclaw/config.json')}`);
  console.log();
}

// ─── Start Flow ─────────────────────────────────────────────

async function runStart(projectDir, parsed, config, soulPath) {
  const enabledAgents = parsed.filter(a => isAgentEnabled(a.name, config));
  const runningNames = new Set(listPids(projectDir).map(p => p.name));
  const startable = enabledAgents.filter(a => !runningNames.has(a.name));

  if (startable.length === 0 && runningNames.size > 0) {
    info('All enabled agents are already running.');
    console.log();
    return;
  }

  if (startable.length === 0) {
    info('No agents are enabled.');
    console.log(`  ${dim('Run')} ${bold('serpentstack persistent --agents')} ${dim('to enable agents.')}`);
    console.log();
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  const toStart = [];

  try {
    divider('Launch');
    console.log();

    for (const agent of startable) {
      const model = getEffectiveModel(agent.name, agent.agentMd.meta, config);
      const yes = await askYesNo(rl, `Start ${bold(agent.name)} ${dim(`(${modelShortName(model)})`)}?`, true);
      if (yes) toStart.push(agent);
    }
  } finally {
    rl.close();
  }

  if (toStart.length === 0) {
    console.log();
    info('No agents selected.');
    console.log();
    return;
  }

  console.log();

  const sharedSoul = readFileSync(soulPath, 'utf8');
  let started = 0;

  for (const { name, agentMd } of toStart) {
    try {
      const effectiveModel = getEffectiveModel(name, agentMd.meta, config);
      const overriddenMd = {
        ...agentMd,
        meta: { ...agentMd.meta, model: effectiveModel },
      };

      const workspacePath = generateWorkspace(projectDir, name, overriddenMd, sharedSoul);
      const absWorkspace = resolve(workspacePath);
      const absProject = resolve(projectDir);

      const openclawCmd = `OPENCLAW_STATE_DIR='${join(absWorkspace, '.state')}' openclaw start --workspace '${absWorkspace}'`;

      const method = openInTerminal(`SerpentStack: ${name}`, openclawCmd, absProject);

      if (method) {
        writePid(projectDir, name, -1); // -1 = terminal-managed
        success(`${bold(name)} opened in ${method} ${dim(`(${modelShortName(effectiveModel)})`)}`);
        started++;
      } else {
        warn(`No terminal detected — starting ${bold(name)} in background`);
        const child = spawn('openclaw', ['start', '--workspace', absWorkspace], {
          stdio: 'ignore',
          detached: true,
          cwd: absProject,
          env: { ...process.env, OPENCLAW_STATE_DIR: join(absWorkspace, '.state') },
        });
        child.unref();
        writePid(projectDir, name, child.pid);
        success(`${bold(name)} started ${dim(`PID ${child.pid}`)}`);
        started++;
      }
    } catch (err) {
      error(`${bold(name)}: ${err.message}`);
    }
  }

  console.log();
  if (started > 0) {
    success(`${started} agent(s) launched — fangs out 🐍`);
    console.log();
    printBox('Manage agents', [
      `${dim('$')} ${bold('serpentstack persistent')}              ${dim('# status dashboard')}`,
      `${dim('$')} ${bold('serpentstack persistent --start')}      ${dim('# launch agents')}`,
      `${dim('$')} ${bold('serpentstack persistent --stop')}       ${dim('# stop all')}`,
      `${dim('$')} ${bold('serpentstack persistent --configure')}  ${dim('# edit project settings')}`,
      `${dim('$')} ${bold('serpentstack persistent --agents')}     ${dim('# change models')}`,
    ]);
  }
}

// ─── Main Entry Point ───────────────────────────────────────

export async function persistent({ stop = false, configure = false, agents = false, start = false } = {}) {
  const projectDir = process.cwd();

  printHeader();

  // ── Stop ──
  if (stop) {
    stopAllAgents(projectDir);
    return;
  }

  // ── Preflight checks ──
  const soulPath = join(projectDir, '.openclaw/SOUL.md');
  if (!existsSync(soulPath)) {
    error('No .openclaw/ workspace found.');
    console.log(`  Run ${bold('serpentstack skills')} first to download the workspace files.`);
    console.log();
    process.exit(1);
  }

  const agentDirs = discoverAgents(projectDir);
  if (agentDirs.length === 0) {
    error('No agents found in .openclaw/agents/');
    console.log(`  Run ${bold('serpentstack skills')} to download the default agents,`);
    console.log(`  or create your own at ${bold('.openclaw/agents/<name>/AGENT.md')}`);
    console.log();
    process.exit(1);
  }

  // Check OpenClaw early
  const hasOpenClaw = await which('openclaw');
  if (!hasOpenClaw) {
    warn('OpenClaw is not installed.');
    console.log();
    console.log(`  ${dim('OpenClaw is the persistent agent runtime.')}`);
    console.log(`  ${dim('Install it first, then re-run this command:')}`);
    console.log();
    console.log(`  ${dim('$')} ${bold('npm install -g openclaw@latest')}`);
    console.log(`  ${dim('$')} ${bold('serpentstack persistent')}`);
    console.log();
    process.exit(1);
  }

  cleanStalePids(projectDir);

  // Parse agent definitions
  const parsed = [];
  for (const agent of agentDirs) {
    try {
      const agentMd = parseAgentMd(agent.agentMdPath);
      parsed.push({ ...agent, agentMd });
    } catch (err) {
      warn(`Skipping ${bold(agent.name)}: ${err.message}`);
    }
  }
  if (parsed.length === 0) {
    error('No valid AGENT.md files found.');
    console.log();
    process.exit(1);
  }

  // Load config
  let config = readConfig(projectDir) || { project: {}, agents: {} };
  const isConfigured = !!config._configured;

  // ── Explicit flag: --configure ──
  if (configure) {
    await runConfigure(projectDir, config, soulPath);
    return;
  }

  // ── Explicit flag: --agents ──
  if (agents) {
    config = readConfig(projectDir) || config; // re-read in case --configure was run first
    await runAgents(projectDir, config, parsed);
    return;
  }

  // ── Explicit flag: --start ──
  if (start) {
    await runStart(projectDir, parsed, config, soulPath);
    return;
  }

  // ── Default: bare `serpentstack persistent` ──
  if (isConfigured) {
    // Already set up — show dashboard
    printStatusDashboard(config, parsed, projectDir);

    const enabledAgents = parsed.filter(a => isAgentEnabled(a.name, config));
    const runningNames = new Set(listPids(projectDir).map(p => p.name));
    const startable = enabledAgents.filter(a => !runningNames.has(a.name));

    if (startable.length === 0 && runningNames.size > 0) {
      info('All enabled agents are running.');
    } else if (startable.length === 0) {
      info('No agents are enabled.');
    } else {
      info(`${startable.length} agent(s) ready to start.`);
    }

    console.log();
    printBox('Commands', [
      `${dim('$')} ${bold('serpentstack persistent --start')}      ${dim('# launch agents')}`,
      `${dim('$')} ${bold('serpentstack persistent --stop')}       ${dim('# stop all')}`,
      `${dim('$')} ${bold('serpentstack persistent --configure')}  ${dim('# edit project settings')}`,
      `${dim('$')} ${bold('serpentstack persistent --agents')}     ${dim('# change models')}`,
    ]);
    console.log();
    return;
  }

  // ── First-time setup: full walkthrough ──
  info('First-time setup — let\'s configure your project and agents.');
  console.log();

  // Step 1: Project settings
  await runConfigure(projectDir, config, soulPath);

  // Re-read config (runConfigure saved it)
  config = readConfig(projectDir) || config;

  // Step 2: Agent settings
  await runAgents(projectDir, config, parsed);

  // Re-read config (runAgents saved it)
  config = readConfig(projectDir) || config;

  // Step 3: Launch
  await runStart(projectDir, parsed, config, soulPath);
}
