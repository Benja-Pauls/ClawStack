import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { info, success, warn, error, bold, dim, green, cyan, yellow, red, divider, printBox, printHeader, spinner } from '../utils/ui.js';
import {
  parseAgentMd,
  discoverAgents,
  generateWorkspace,
} from '../utils/agent-utils.js';
import {
  readConfig,
  writeConfig,
  detectProjectDefaults,
  detectTemplateDefaults,
  getEffectiveModel,
  isAgentEnabled,
} from '../utils/config.js';
import { detectModels, modelShortName, detectSystemCapabilities } from '../utils/models.js';

// ─── Helpers ────────────────────────────────────────────────

function which(cmd) {
  return new Promise((resolve) => {
    execFile('which', [cmd], (err) => resolve(!err));
  });
}

function execPromise(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15000, ...opts }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || stdout?.trim() || err.message;
        reject(new Error(msg));
      } else {
        resolve(stdout);
      }
    });
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

async function isGatewayRunning() {
  try {
    // Try the WebSocket upgrade endpoint with a plain HTTP request
    const resp = await fetch('http://127.0.0.1:18789/', { signal: AbortSignal.timeout(2000) });
    return true; // Any response means gateway is up
  } catch {
    return false;
  }
}

// ─── Ollama Provider Registration ────────────────────────────

/**
 * Ensure Ollama is registered as a provider in OpenClaw's config.
 * Without this, OpenClaw rejects ollama/* models with
 * "Ollama requires authentication to be registered as a provider."
 */
async function ensureOllamaProvider() {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json');
  if (!existsSync(configPath)) return;

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (!config.auth) config.auth = {};
    if (!config.auth.profiles) config.auth.profiles = {};

    if (!config.auth.profiles['ollama:default']) {
      config.auth.profiles['ollama:default'] = {
        provider: 'ollama',
        mode: 'api_key',
      };
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    }

    // Also ensure the main agent's auth-profiles.json has the key
    const mainAuthPath = join(homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json');
    if (existsSync(mainAuthPath)) {
      const auth = JSON.parse(readFileSync(mainAuthPath, 'utf8'));
      if (!auth.profiles['ollama:default']) {
        auth.profiles['ollama:default'] = {
          type: 'api_key',
          provider: 'ollama',
          key: 'ollama-local',
        };
        writeFileSync(mainAuthPath, JSON.stringify(auth, null, 2) + '\n', 'utf8');
      }
    }
  } catch {
    // Best-effort — don't block the flow
  }
}

/**
 * Ensure a specific agent's auth-profiles.json includes Ollama credentials.
 */
function ensureAgentOllamaAuth(agentName) {
  const agentAuthDir = join(homedir(), '.openclaw', 'agents', agentName, 'agent');
  const authPath = join(agentAuthDir, 'auth-profiles.json');

  try {
    mkdirSync(agentAuthDir, { recursive: true });

    let auth = { version: 1, profiles: {} };
    if (existsSync(authPath)) {
      auth = JSON.parse(readFileSync(authPath, 'utf8'));
    }

    if (!auth.profiles['ollama:default']) {
      auth.profiles['ollama:default'] = {
        type: 'api_key',
        provider: 'ollama',
        key: 'ollama-local',
      };
      writeFileSync(authPath, JSON.stringify(auth, null, 2) + '\n', 'utf8');
    }
  } catch {
    // Best-effort
  }
}

// ─── Cron Job Cleanup ───────────────────────────────────────

/**
 * Remove ALL cron jobs for a given agent by editing the jobs file directly.
 * This works even when the gateway isn't running (unlike `openclaw cron rm`).
 */
async function cleanCronJobsForAgent(agentName) {
  const jobsPath = join(homedir(), '.openclaw', 'cron', 'jobs.json');
  if (!existsSync(jobsPath)) return;

  try {
    const data = JSON.parse(readFileSync(jobsPath, 'utf8'));
    if (!data.jobs || !Array.isArray(data.jobs)) return;

    const before = data.jobs.length;
    data.jobs = data.jobs.filter(j =>
      j.agentId !== agentName &&
      !(j.name && j.name.startsWith(`${agentName}-`))
    );
    const removed = before - data.jobs.length;

    if (removed > 0) {
      writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
  } catch {
    // Best-effort — gateway will clean up on next start
  }
}

// ─── Agent Bootstrap ────────────────────────────────────────

/**
 * Write a BOOTSTRAP.md to the agent workspace so it outputs
 * a friendly startup greeting on first run.
 */
function writeAgentBootstrap(workspacePath, agentName, agentMd, config) {
  const projectName = config?.project?.name || basename(process.cwd());
  const schedule = (agentMd.meta.schedule || []).map(s => `${s.task} (every ${s.every})`).join(', ');
  const description = agentMd.meta.description || 'Background agent';

  const bootstrap = `# 🐍 SerpentStack Persistent Agent — Reporting for Slithering!

## Agent: ${agentName}
**Project:** ${projectName}
**Purpose:** ${description}
**Schedule:** ${schedule || 'on-demand'}
**Working directory:** ${process.cwd()}

## Your first task

Print the following greeting, then begin your scheduled duties:

\`\`\`
🐍 SerpentStack Agent "${agentName}" is online!
   Project: ${projectName}
   Purpose: ${description}
   Schedule: ${schedule}
   Directory: ${process.cwd()}

   Reporting for slithering! 🐍
\`\`\`

After printing the greeting, read SOUL.md and AGENTS.md to understand your role, then start your first scheduled task.

Delete this file after reading it — you won't need it again.
`;

  const bootstrapPath = join(workspacePath, 'BOOTSTRAP.md');
  writeFileSync(bootstrapPath, bootstrap, 'utf8');
}

// ─── Preflight ──────────────────────────────────────────────

async function preflight(projectDir) {
  const soulPath = join(projectDir, '.openclaw/SOUL.md');

  // Auto-create .openclaw workspace if missing
  if (!existsSync(soulPath)) {
    info('No .openclaw/ workspace found — setting up now...');
    console.log();
    try {
      const { skillsInit } = await import('./skills-init.js');
      await skillsInit({ force: false });
      console.log();
    } catch (err) {
      error(`Failed to set up workspace: ${err.message}`);
      console.log(`  ${dim('Run')} ${bold('serpentstack skills')} ${dim('manually to download skills and agent configs.')}`);
      console.log();
      process.exit(1);
    }
  }

  // Check for agent definitions
  const agentDirs = discoverAgents(projectDir);
  if (agentDirs.length === 0) {
    error('No agents found in .openclaw/agents/');
    console.log(`  ${dim('Run')} ${bold('serpentstack skills')} ${dim('to download the default agents.')}`);
    console.log();
    process.exit(1);
  }

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

  // Detect runtime dependencies in parallel
  const spin = spinner('Checking runtime...');
  const [hasOpenClaw, hasOllama, available] = await Promise.all([
    which('openclaw'),
    which('ollama'),
    detectModels(),
  ]);
  spin.stop();

  return { soulPath, parsed, hasOpenClaw, hasOllama, available };
}

function printPreflightStatus(hasOpenClaw, available) {
  divider('Runtime');
  console.log();

  if (hasOpenClaw) {
    console.log(`    ${green('✓')} OpenClaw ${dim('— persistent agent runtime')}`);
  } else {
    console.log(`    ${red('✗')} OpenClaw ${dim('— not installed')}`);
  }

  if (available.ollamaRunning) {
    console.log(`    ${green('✓')} Ollama  ${dim(`— running, ${available.local.length} model(s) installed`)}`);
  } else if (available.ollamaInstalled) {
    console.log(`    ${yellow('△')} Ollama  ${dim('— installed but not running')}`);
  } else {
    console.log(`    ${yellow('○')} Ollama  ${dim('— not installed (optional, for free local models)')}`);
  }

  if (available.hasApiKey) {
    console.log(`    ${green('✓')} API key ${dim('— configured for cloud models')}`);
  }

  console.log();

  const issues = [];
  if (!hasOpenClaw) {
    issues.push({ label: 'Install OpenClaw (required to run agents)', cmd: 'npm install -g openclaw@latest' });
  }
  if (!available.ollamaInstalled) {
    issues.push({ label: 'Install Ollama for free local models (recommended)', cmd: 'curl -fsSL https://ollama.com/install.sh | sh' });
  } else if (!available.ollamaRunning) {
    issues.push({ label: 'Start Ollama', cmd: 'ollama serve' });
  }

  for (const issue of issues) {
    console.log(`  ${dim(issue.label + ':')}`);
    console.log(`    ${dim('$')} ${bold(issue.cmd)}`);
    console.log();
  }

  return hasOpenClaw;
}

// ─── Ollama Install ─────────────────────────────────────────

/**
 * Install Ollama automatically. Returns true if successful.
 */
async function installOllama() {
  const platform = process.platform;

  if (platform === 'darwin') {
    const hasBrew = await which('brew');
    if (hasBrew) {
      info('Installing Ollama via Homebrew...');
      console.log();
      try {
        const child = spawn('brew', ['install', 'ollama'], { stdio: 'inherit' });
        const code = await new Promise(r => child.on('close', r));
        if (code === 0) {
          console.log();
          success('Ollama installed');
          info('Starting Ollama...');
          spawn('brew', ['services', 'start', 'ollama'], { stdio: 'ignore', detached: true }).unref();
          await new Promise(r => setTimeout(r, 3000));
          return true;
        }
      } catch { /* fall through */ }
    }

    // Fallback: official install script
    info('Installing Ollama from ollama.com...');
    console.log();
    try {
      const child = spawn('bash', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], { stdio: 'inherit' });
      const code = await new Promise(r => child.on('close', r));
      if (code === 0) {
        console.log();
        success('Ollama installed');
        await new Promise(r => setTimeout(r, 2000));
        return true;
      }
    } catch { /* fall through */ }
  }

  if (platform === 'linux') {
    info('Installing Ollama...');
    console.log();
    try {
      const child = spawn('bash', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], { stdio: 'inherit' });
      const code = await new Promise(r => child.on('close', r));
      if (code === 0) {
        console.log();
        success('Ollama installed');
        spawn('ollama', ['serve'], { stdio: 'ignore', detached: true }).unref();
        await new Promise(r => setTimeout(r, 3000));
        return true;
      }
    } catch { /* fall through */ }
  }

  error('Automatic install failed. Install Ollama manually:');
  console.log(`    ${dim('$')} ${bold('curl -fsSL https://ollama.com/install.sh | sh')}`);
  console.log();
  return false;
}

/**
 * Ensure Ollama is installed and running. Installs if needed (with user consent).
 */
async function ensureOllama(rl, available) {
  if (available.ollamaInstalled && available.ollamaRunning) {
    return { installed: true, running: true };
  }

  if (!available.ollamaInstalled) {
    console.log();
    const doInstall = await askYesNo(rl, `Ollama is not installed. Install it now? ${dim('(free, open-source)')}`, true);
    if (!doInstall) return { installed: false, running: false };

    rl.pause();
    const ok = await installOllama();
    rl.resume();

    if (!ok) return { installed: false, running: false };
    return { installed: true, running: true };
  }

  if (!available.ollamaRunning) {
    console.log();
    info('Ollama is installed but not running. Starting it...');
    spawn('ollama', ['serve'], { stdio: 'ignore', detached: true }).unref();
    await new Promise(r => setTimeout(r, 3000));
    return { installed: true, running: true };
  }

  return { installed: true, running: true };
}

// ─── Model Install ──────────────────────────────────────────

function ollamaPull(modelName) {
  return new Promise((resolve) => {
    console.log();
    info(`Downloading ${bold(modelName)}... ${dim('(this may take a few minutes)')}`);
    console.log();

    const child = spawn('ollama', ['pull', modelName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (data) => {
      const line = data.toString().trim();
      if (line) process.stderr.write(`    ${line}\r`);
    });
    child.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) process.stderr.write(`    ${line}\r`);
    });

    child.on('close', (code) => {
      process.stderr.write('\x1b[K');
      if (code === 0) {
        success(`${bold(modelName)} installed`);
        console.log();
        resolve(true);
      } else {
        error(`Failed to download ${bold(modelName)} (exit code ${code})`);
        console.log();
        resolve(false);
      }
    });

    child.on('error', (err) => {
      error(`Could not run ollama pull: ${err.message}`);
      console.log();
      resolve(false);
    });
  });
}

// ─── Model Picker ───────────────────────────────────────────

async function pickModel(rl, agentName, currentModel, available) {
  const choices = [];

  // Section 1: Installed local models
  if (available.local.length > 0) {
    console.log(`    ${dim('── Installed')} ${green('ready')} ${dim('────────────────────')}`);
    for (const m of available.local) {
      const isCurrent = m.id === currentModel;
      const idx = choices.length;
      choices.push({ ...m, action: 'use' });
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

  // Section 2: Downloadable models — always shown
  if (available.recommended.length > 0) {
    const liveTag = available.recommendedLive ? dim('live from ollama.com') : dim('cached list');
    const needsOllama = !available.ollamaInstalled ? dim(' · requires Ollama') : '';
    console.log(`    ${dim('── Download')} ${cyan('free')} ${dim('(')}${liveTag}${needsOllama}${dim(') ──')}`);
    const toShow = available.recommended.slice(0, 8);
    for (const r of toShow) {
      const idx = choices.length;
      const isCurrent = `ollama/${r.name}` === currentModel;
      choices.push({
        id: `ollama/${r.name}`, name: r.name, params: r.params,
        size: r.size, description: r.description,
        tier: 'downloadable', action: 'download',
      });
      const marker = isCurrent ? green('>') : ' ';
      const num = dim(`${idx + 1}.`);
      const label = isCurrent ? bold(r.name) : r.name;
      const params = r.params ? dim(` ${r.params}`) : '';
      const size = r.size ? dim(` (${r.size})`) : '';
      const desc = r.description ? dim(` — ${r.description}`) : '';
      const tag = isCurrent ? green(' ← current') : '';
      console.log(`  ${marker} ${num} ${label}${params}${size}${desc}${tag}`);
    }
    if (available.recommended.length > toShow.length) {
      console.log(`    ${dim(`... and ${available.recommended.length - toShow.length} more at`)} ${cyan('ollama.com/library')}`);
    }
  }

  // Section 3: Cloud models
  if (available.cloud.length > 0) {
    const apiNote = available.hasApiKey ? green('key ✓') : yellow('needs API key');
    console.log(`    ${dim('── Cloud')} ${apiNote} ${dim('─────────────────────')}`);
    for (const m of available.cloud) {
      const isCurrent = m.id === currentModel;
      const idx = choices.length;
      choices.push({ ...m, action: 'use' });
      const marker = isCurrent ? green('>') : ' ';
      const num = dim(`${idx + 1}.`);
      const label = isCurrent ? bold(m.name) : m.name;
      const provider = m.provider ? dim(` (${m.provider})`) : '';
      const tag = isCurrent ? green(' ← current') : '';
      console.log(`  ${marker} ${num} ${label}${provider}${tag}`);
    }
  }

  if (choices.length === 0) {
    warn('No models available. Install Ollama and pull a model first.');
    return currentModel;
  }

  // If current model isn't in any list, append at end (never unshift — breaks numbering)
  if (!choices.some(c => c.id === currentModel)) {
    const idx = choices.length;
    choices.push({ id: currentModel, name: modelShortName(currentModel), tier: 'custom', action: 'use' });
    console.log(`    ${dim('── Current ─────────────────────────')}`);
    console.log(`  ${green('>')} ${dim(`${idx + 1}.`)} ${bold(modelShortName(currentModel))} ${dim('(not installed)')} ${green('← current')}`);
  }

  const currentIdx = choices.findIndex(c => c.id === currentModel);
  const defaultNum = currentIdx >= 0 ? currentIdx + 1 : 1;

  const answer = await rl.question(`    ${dim(`Enter 1-${choices.length}`)} ${dim(`[${defaultNum}]`)}: `);
  const idx = parseInt(answer.trim(), 10) - 1;
  const selected = (idx >= 0 && idx < choices.length) ? choices[idx] : choices[Math.max(0, currentIdx)];

  // Handle downloadable model selection — install Ollama + pull model automatically
  if (selected.action === 'download') {
    const ollama = await ensureOllama(rl, available);

    if (!ollama.installed) {
      warn(`Cannot download ${bold(selected.name)} without Ollama.`);
      info('Saving your selection — run this command after installing Ollama:');
      console.log(`    ${dim('$')} ${bold('serpentstack persistent --start')}`);
      console.log();
      return selected.id;
    }

    if (!ollama.running) {
      warn('Ollama installed but could not start. Try manually:');
      console.log(`    ${dim('$')} ${bold('ollama serve')}`);
      console.log();
      return selected.id;
    }

    // Ollama is ready — download the model
    rl.pause();
    const pulled = await ollamaPull(selected.name);
    rl.resume();

    if (!pulled) {
      warn(`Download failed. Keeping previous model: ${bold(modelShortName(currentModel))}`);
      return currentModel;
    }
  }

  // Warn about cloud costs
  if (selected.tier === 'cloud' && (available.local.length > 0 || available.recommended.length > 0)) {
    warn('Cloud models cost tokens per heartbeat. Consider a local model for persistent agents.');
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
        if (child.pid && !child.killed) return bin;
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

async function stopAllAgents(projectDir, config, parsed) {
  const hasOpenClaw = await which('openclaw');
  let stopped = 0;

  // Get list of agents from config
  const agentNames = parsed
    ? parsed.map(a => a.name)
    : Object.keys(config?.agents || {});

  for (const name of agentNames) {
    let didSomething = false;

    // Always clean cron jobs from file (works without gateway)
    await cleanCronJobsForAgent(name);

    if (hasOpenClaw) {
      // Also try to remove via gateway API if it's running
      try {
        const out = await execPromise('openclaw', ['cron', 'list', '--json']);
        const data = JSON.parse(out);
        const jobs = Array.isArray(data) ? data : (data.jobs || []);
        const agentJobs = jobs.filter(j =>
          j.agentId === name || j.agent === name ||
          (j.name && j.name.startsWith(`${name}-`))
        );
        for (const j of agentJobs) {
          try {
            await execPromise('openclaw', ['cron', 'rm', j.id || j.name]);
          } catch { /* best-effort */ }
        }
      } catch { /* gateway might not be running — file cleanup above handles it */ }

      // Remove agent registration from OpenClaw
      try {
        await execPromise('openclaw', ['agents', 'delete', name, '--force']);
        didSomething = true;
      } catch { /* agent may not exist */ }
    }

    // Also clean via file if needed
    if (!didSomething) {
      // Check if the agent exists in the openclaw config file directly
      const ocConfigPath = join(homedir(), '.openclaw', 'openclaw.json');
      if (existsSync(ocConfigPath)) {
        try {
          const ocConfig = JSON.parse(readFileSync(ocConfigPath, 'utf8'));
          const before = (ocConfig.agents?.list || []).length;
          ocConfig.agents.list = (ocConfig.agents?.list || []).filter(a => a.id !== name && a.name !== name);
          if (ocConfig.agents.list.length < before) {
            writeFileSync(ocConfigPath, JSON.stringify(ocConfig, null, 2) + '\n', 'utf8');
            didSomething = true;
          }
        } catch { /* best-effort */ }
      }
    }

    if (didSomething) {
      success(`Stopped ${bold(name)}`);
      stopped++;
    }
  }

  // Kill the gateway process if it's running
  const gatewayRunning = await isGatewayRunning();
  if (gatewayRunning) {
    try {
      // Find the gateway PID
      const out = await execPromise('lsof', ['-ti', ':18789']);
      const pids = out.trim().split('\n').filter(Boolean).map(Number);
      for (const pid of pids) {
        try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
      }
      success('Gateway stopped');
    } catch {
      warn('Could not stop gateway automatically. Close the gateway terminal manually.');
    }
  }

  if (stopped === 0 && !gatewayRunning) {
    info('No agents are currently running.');
  } else if (stopped > 0) {
    console.log();
    success(`${stopped} agent(s) stopped`);
  }
  console.log();
  return stopped;
}

// ─── Agent Status ───────────────────────────────────────────

function printAgentLine(name, agentMd, config) {
  const model = getEffectiveModel(name, agentMd.meta, config);
  const schedule = (agentMd.meta.schedule || []).map(s => s.every).join(', ');
  const modelStr = modelShortName(model);
  const enabled = isAgentEnabled(name, config);

  if (enabled) {
    console.log(`    ${green('●')} ${bold(name)}  ${dim(modelStr)}  ${dim(schedule)}  ${green('enabled')}`);
  } else {
    console.log(`    ${dim('○')} ${dim(name)}  ${dim(modelStr)}  ${dim(schedule)}  ${dim('disabled')}`);
  }
}

function printStatusDashboard(config, parsed) {
  console.log(`  ${bold(config.project.name)} ${dim(`— ${config.project.framework}`)}`);
  console.log(`  ${dim(`Dev: ${config.project.devCmd} · Test: ${config.project.testCmd}`)}`);
  console.log();

  divider('Agents');
  console.log();
  for (const { name, agentMd } of parsed) {
    printAgentLine(name, agentMd, config);
  }
  console.log();
}

// ─── Models Command ─────────────────────────────────────────

async function runModels(available) {
  divider('Installed Models');
  console.log();

  if (available.local.length > 0) {
    for (const m of available.local) {
      const params = m.params ? dim(` ${m.params}`) : '';
      const quant = m.quant ? dim(` ${m.quant}`) : '';
      const size = m.size ? dim(` (${m.size})`) : '';
      console.log(`    ${green('●')} ${bold(m.name)}${params}${quant}${size}`);
    }
  } else {
    console.log(`    ${dim('No local models installed.')}`);
  }

  if (available.cloud.length > 0) {
    console.log();
    const apiNote = available.hasApiKey ? green('key ✓') : yellow('needs API key');
    console.log(`  ${dim('Cloud models')} ${apiNote}`);
    for (const m of available.cloud) {
      console.log(`    ${dim('●')} ${m.name} ${dim(`(${m.provider})`)}`);
    }
  }

  console.log();

  if (available.recommended.length > 0) {
    divider('Recommended Models');
    console.log();
    if (available.recommendedLive) {
      success(`Fetched latest models from ${cyan('ollama.com/library')}`);
    } else {
      warn('Could not reach ollama.com — showing cached recommendations');
    }
    console.log();
    for (const r of available.recommended) {
      console.log(`    ${dim('$')} ${bold(`ollama pull ${r.name}`)}  ${dim(`${r.params} — ${r.description}`)}`);
    }
    console.log();
  }

  if (!available.ollamaInstalled) {
    console.log(`  ${dim('Install Ollama for free local models:')}`);
    console.log(`    ${dim('$')} ${bold('curl -fsSL https://ollama.com/install.sh | sh')}`);
    console.log();
  } else if (!available.ollamaRunning) {
    console.log(`  ${dim('Start Ollama to use local models:')}`);
    console.log(`    ${dim('$')} ${bold('ollama serve')}`);
    console.log();
  }

  console.log(`  ${dim('Browse all models:')} ${cyan('https://ollama.com/library')}`);
  console.log();
}

// ─── Configure Flow ─────────────────────────────────────────

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

    // Update SOUL.md
    if (existsSync(soulPath)) {
      let soul = readFileSync(soulPath, 'utf8');
      const ctx = [
        `# ${config.project.name} — Persistent Development Agents`,
        '', `**Project:** ${config.project.name}`,
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

  config._configured = true;
  writeConfig(projectDir, config);
  success(`Saved ${bold('.openclaw/config.json')}`);
  console.log();
}

// ─── Agents Flow ────────────────────────────────────────────

const AGENT_SUMMARIES = {
  'log-watcher': 'Monitors your dev server health and log output every 30–60s. Catches backend crashes, frontend build errors, and import failures — reports them with file paths and suggested fixes.',
  'test-runner': 'Runs your test suite every 5 min and lint/typecheck every 15 min. Catches regressions before you commit — shows which test failed, what changed, and whether the test or source needs fixing.',
  'skill-maintainer': 'Checks every hour whether your .skills/ files still match the actual codebase. When code patterns drift from what skills describe, it proposes exact updates so IDE agents stay accurate.',
};

async function runAgents(projectDir, config, parsed, available) {
  const sys = detectSystemCapabilities();

  divider('Your System');
  console.log(`    ${dim('RAM:')} ${bold(sys.totalGB + ' GB')} total, ${sys.freeGB} GB free`);
  console.log(`    ${dim(sys.recommendation)}`);
  console.log();

  divider('Agents');
  console.log(`  ${dim('Each agent runs in its own terminal on a schedule.')}`);
  console.log(`  ${dim('Enable the ones you want, then pick a model for each.')}`);
  console.log();

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    for (const { name, agentMd } of parsed) {
      const existingAgent = config.agents?.[name];
      const currentEnabled = existingAgent?.enabled !== false;
      const currentModel = existingAgent?.model || 'ollama/llama3.2';
      const schedule = (agentMd.meta.schedule || []).map(s => s.every).join(', ');

      console.log(`  ${bold(name)}  ${dim(`(${schedule || 'manual'})`)}`);
      const summary = AGENT_SUMMARIES[name] || agentMd.meta.description || '';
      if (summary) {
        const words = summary.split(' ');
        let line = '';
        for (const word of words) {
          if (line.length + word.length + 1 > 68) {
            console.log(`    ${dim(line)}`);
            line = word;
          } else {
            line = line ? `${line} ${word}` : word;
          }
        }
        if (line) console.log(`    ${dim(line)}`);
      }

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

function isModelAvailable(modelId, available) {
  // Check if it's an installed local model
  if (available.local.some(m => m.id === modelId)) return true;
  // Check if it's a cloud model with API key
  if (available.cloud.some(m => m.id === modelId) && available.hasApiKey) return true;
  return false;
}

async function runStart(projectDir, parsed, config, soulPath, hasOpenClaw) {
  if (!hasOpenClaw) {
    error('Cannot launch agents — OpenClaw is not installed.');
    console.log(`    ${dim('$')} ${bold('npm install -g openclaw@latest')}`);
    console.log();
    return;
  }

  const enabledAgents = parsed.filter(a => isAgentEnabled(a.name, config));

  if (enabledAgents.length === 0) {
    info('No agents are enabled.');
    console.log(`  ${dim('Run')} ${bold('serpentstack persistent --agents')} ${dim('to enable agents.')}`);
    console.log();
    return;
  }

  // Re-detect models fresh (Ollama may have been installed during --agents flow)
  const available = await detectModels();

  // Check model availability for each agent BEFORE launching
  const launchable = [];
  const blocked = [];

  for (const agent of enabledAgents) {
    const model = getEffectiveModel(agent.name, agent.agentMd.meta, config);
    if (isModelAvailable(model, available)) {
      launchable.push(agent);
    } else {
      blocked.push({ agent, model });
    }
  }

  if (blocked.length > 0) {
    divider('Model Issues');
    console.log();
    for (const { agent, model } of blocked) {
      const shortName = modelShortName(model);
      if (model.startsWith('ollama/')) {
        if (!available.ollamaInstalled) {
          warn(`${bold(agent.name)} needs ${bold(shortName)} but Ollama is not installed.`);
          console.log(`    ${dim('$')} ${bold('curl -fsSL https://ollama.com/install.sh | sh')}`);
          console.log(`    ${dim('$')} ${bold(`ollama pull ${shortName}`)}`);
        } else if (!available.ollamaRunning) {
          warn(`${bold(agent.name)} needs ${bold(shortName)} but Ollama is not running.`);
          console.log(`    ${dim('$')} ${bold('ollama serve')}`);
        } else {
          warn(`${bold(agent.name)} needs ${bold(shortName)} which is not installed.`);
          console.log(`    ${dim('$')} ${bold(`ollama pull ${shortName}`)}`);
        }
      } else {
        warn(`${bold(agent.name)} needs ${bold(shortName)} but no API key is configured.`);
        console.log(`    ${dim('$')} ${bold('openclaw configure')}`);
      }
      console.log();
    }

    if (launchable.length === 0) {
      error('No agents can launch — fix the model issues above first.');
      console.log(`  ${dim('Or run')} ${bold('serpentstack persistent --agents')} ${dim('to pick different models.')}`);
      console.log();
      return;
    }

    info(`${launchable.length} of ${enabledAgents.length} agent(s) can launch. Continuing with available agents.`);
    console.log();
  }

  // Confirm which agents to start
  const rl = createInterface({ input: stdin, output: stdout });
  const toStart = [];

  try {
    divider('Launch');
    console.log();

    for (const agent of launchable) {
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

  // Ensure Ollama is registered as a provider with OpenClaw
  await ensureOllamaProvider();

  // Ensure gateway is running (background — no visible terminal)
  let gatewayRunning = await isGatewayRunning();

  if (!gatewayRunning) {
    info('Starting OpenClaw gateway in background...');

    const child = spawn('openclaw', ['gateway'], {
      stdio: 'ignore', detached: true, cwd: resolve(projectDir),
      env: { ...process.env, OLLAMA_API_KEY: 'ollama-local' },
    });
    child.unref();

    // Wait for gateway to be ready
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (await isGatewayRunning()) {
        gatewayRunning = true;
        break;
      }
    }

    if (!gatewayRunning) {
      error('Gateway did not start. Check OpenClaw installation:');
      console.log(`    ${dim('$')} ${bold('openclaw gateway')}  ${dim('# try starting manually')}`);
      console.log();
      return;
    }
    success('Gateway running');
  } else {
    success('Gateway already running');
  }

  // Register agents and create cron jobs
  const sharedSoul = readFileSync(soulPath, 'utf8');
  let registered = 0;
  const launched = [];

  for (const { name, agentMd } of toStart) {
    try {
      const effectiveModel = getEffectiveModel(name, agentMd.meta, config);
      const overriddenMd = {
        ...agentMd,
        meta: { ...agentMd.meta, model: effectiveModel },
      };

      const workspacePath = generateWorkspace(projectDir, name, overriddenMd, sharedSoul);
      const absWorkspace = resolve(workspacePath);

      // Write BOOTSTRAP.md for the agent's startup greeting
      writeAgentBootstrap(absWorkspace, name, agentMd, config);

      // Clean old cron jobs for this agent BEFORE re-registering
      await cleanCronJobsForAgent(name);

      // Register agent with OpenClaw (delete + re-add to ensure correct model)
      try {
        await execPromise('openclaw', ['agents', 'delete', name, '--force']).catch(() => {});

        await execPromise('openclaw', [
          'agents', 'add', name,
          '--workspace', absWorkspace,
          '--model', effectiveModel,
          '--non-interactive',
        ]);

        // Ensure per-agent Ollama auth if using local model
        if (effectiveModel.startsWith('ollama/')) {
          ensureAgentOllamaAuth(name);
        }
      } catch (err) {
        warn(`Could not register ${bold(name)}: ${err.message || 'unknown error'}`);
        continue;
      }

      // Add cron jobs for the agent's schedule
      const schedules = agentMd.meta.schedule || [];
      for (const sched of schedules) {
        try {
          await execPromise('openclaw', [
            'cron', 'add',
            '--agent', name,
            '--model', effectiveModel,
            '--every', sched.every,
            '--message', `Run task: ${sched.task}`,
            '--name', `${name}-${sched.task}`,
            '--light-context',
          ]);
        } catch {
          // Cron job may already exist
        }
      }

      launched.push({ name, agentMd, effectiveModel });
      registered++;
    } catch (err) {
      error(`${bold(name)}: ${err.message}`);
    }
  }

  if (registered === 0) {
    console.log();
    error('No agents were registered.');
    console.log();
    return;
  }

  // Open a terminal window per agent showing its activity
  for (const { name, agentMd, effectiveModel } of launched) {
    const description = AGENT_SUMMARIES[name] || agentMd.meta.description || '';
    const schedule = (agentMd.meta.schedule || []).map(s => `${s.task} (every ${s.every})`).join(', ');
    const modelName = modelShortName(effectiveModel);
    const projectName = config?.project?.name || basename(projectDir);

    // Build a shell command that shows a branded header then tails filtered logs
    const header = [
      '',
      `  🐍 SerpentStack Agent: ${name}`,
      `  Project: ${projectName}`,
      `  Model: ${modelName}`,
      `  Schedule: ${schedule}`,
      '',
      `  ${description}`,
      '',
      `  Watching for activity... (Ctrl+C to close this window)`,
      `  ${'─'.repeat(60)}`,
      '',
    ].join('\\n');

    const watchCmd = `printf '${header}' && openclaw logs --follow --local-time 2>&1 | grep --line-buffered '${name}'`;
    const method = openInTerminal(`🐍 ${name}`, watchCmd, resolve(projectDir));

    if (method) {
      success(`${bold(name)} → opened in ${method} ${dim(`(${modelName})`)}`);
    } else {
      success(`${bold(name)} registered ${dim(`(${modelName})`)}`);
    }
  }

  console.log();
  success(`${registered} agent(s) launched — fangs out 🐍`);
  console.log();

  printBox('Your agents are running', [
    `${dim('Each agent has its own terminal showing live activity.')}`,
    `${dim('Close a terminal window to stop watching (agent keeps running).')}`,
    '',
    `${dim('$')} ${bold('serpentstack persistent --watch')}   ${dim('# combined activity feed')}`,
    `${dim('$')} ${bold('serpentstack persistent --stop')}    ${dim('# stop all agents + gateway')}`,
    `${dim('$')} ${bold('serpentstack persistent')}           ${dim('# status dashboard')}`,
  ]);
  console.log();
}

// ─── Watch Flow ─────────────────────────────────────────────

async function runWatch() {
  const gatewayRunning = await isGatewayRunning();

  if (!gatewayRunning) {
    error('Gateway is not running. Start agents first:');
    console.log(`    ${dim('$')} ${bold('serpentstack persistent --start')}`);
    console.log();
    return;
  }

  divider('Live Agent Activity');
  console.log(`  ${dim('Streaming logs from OpenClaw gateway. Press Ctrl+C to stop.')}`);
  console.log();

  // Stream openclaw logs --follow as a child process with inherited stdio
  const child = spawn('openclaw', ['logs', '--follow', '--local-time', '--limit', '30'], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  // Handle clean exit on Ctrl+C
  const handler = () => {
    child.kill('SIGTERM');
    console.log();
    info('Stopped watching. Agents are still running in the background.');
    console.log();
    process.exit(0);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);

  await new Promise((resolve) => {
    child.on('close', resolve);
    child.on('error', (err) => {
      error(`Could not stream logs: ${err.message}`);
      resolve();
    });
  });
}

// ─── Main Entry Point ───────────────────────────────────────

export async function persistent({ stop = false, configure = false, agents = false, start = false, models = false, watch = false } = {}) {
  const projectDir = process.cwd();

  // ── --watch: live agent activity feed (no preflight needed) ──
  if (watch) {
    printHeader();
    await runWatch();
    return;
  }

  printHeader();

  // ── Full preflight (auto-creates .openclaw if missing) ──
  const { soulPath, parsed, hasOpenClaw, available } = await preflight(projectDir);

  // Load config
  let config = readConfig(projectDir) || { project: {}, agents: {} };
  const isConfigured = !!config._configured;

  // ── --stop: stop all agents ──
  if (stop) {
    await stopAllAgents(projectDir, config, parsed);
    return;
  }

  // ── --models: list installed and recommended models ──
  if (models) {
    await runModels(available);
    return;
  }

  // ── --configure: edit project settings ──
  if (configure) {
    await runConfigure(projectDir, config, soulPath);
    return;
  }

  // ── --agents: edit agent models and enabled state ──
  if (agents) {
    config = readConfig(projectDir) || config;
    await runAgents(projectDir, config, parsed, available);
    return;
  }

  // ── --start: launch agents ──
  if (start) {
    await runStart(projectDir, parsed, config, soulPath, hasOpenClaw);
    return;
  }

  // ── Bare `serpentstack persistent` ──
  if (isConfigured) {
    printStatusDashboard(config, parsed);

    const enabledAgents = parsed.filter(a => isAgentEnabled(a.name, config));
    if (enabledAgents.length === 0) {
      info('No agents are enabled.');
    } else {
      info(`${enabledAgents.length} agent(s) enabled.`);
    }

    console.log();
    printBox('Commands', [
      `${dim('$')} ${bold('serpentstack persistent --start')}      ${dim('# launch agents')}`,
      `${dim('$')} ${bold('serpentstack persistent --watch')}      ${dim('# live activity feed')}`,
      `${dim('$')} ${bold('serpentstack persistent --stop')}       ${dim('# stop all')}`,
      `${dim('$')} ${bold('serpentstack persistent --configure')}  ${dim('# edit project settings')}`,
      `${dim('$')} ${bold('serpentstack persistent --agents')}     ${dim('# change models')}`,
      `${dim('$')} ${bold('serpentstack persistent --models')}     ${dim('# list & install models')}`,
    ]);
    console.log();
    return;
  }

  // ── First-time setup: guided walkthrough ──
  const canLaunch = printPreflightStatus(hasOpenClaw, available);

  if (!canLaunch) {
    console.log(`  ${dim('Install the missing dependencies above, then run:')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack persistent')}`);
    console.log();

    const rl = createInterface({ input: stdin, output: stdout });
    let proceed;
    try {
      proceed = await askYesNo(rl, 'Continue with project configuration anyway?', true);
    } finally {
      rl.close();
    }

    if (!proceed) {
      console.log();
      return;
    }
    console.log();
  }

  // Step 1: Project settings
  await runConfigure(projectDir, config, soulPath);
  config = readConfig(projectDir) || config;

  // Step 2: Agent settings
  await runAgents(projectDir, config, parsed, available);
  config = readConfig(projectDir) || config;

  // Step 3: Launch (only if OpenClaw is installed)
  if (canLaunch) {
    await runStart(projectDir, parsed, config, soulPath, hasOpenClaw);
  } else {
    console.log();
    info('Skipping launch — install OpenClaw first, then run:');
    console.log(`    ${dim('$')} ${bold('serpentstack persistent --start')}`);
    console.log();
  }
}
