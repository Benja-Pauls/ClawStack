import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { info, success, warn, error, bold, dim, green, cyan, yellow, red, divider, printBox, printHeader, spinner } from '../utils/ui.js';
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
import { detectModels, modelShortName, detectSystemCapabilities } from '../utils/models.js';

// ─── Helpers ────────────────────────────────────────────────

function which(cmd) {
  return new Promise((resolve) => {
    execFile('which', [cmd], (err) => resolve(!err));
  });
}

function execPromise(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15000 }, (err, stdout, stderr) => {
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

// ─── Preflight ──────────────────────────────────────────────

/**
 * Check all prerequisites and return a status object.
 * Exits the process with helpful guidance if anything critical is missing.
 */
async function preflight(projectDir) {
  const soulPath = join(projectDir, '.openclaw/SOUL.md');

  // Check for .openclaw workspace
  if (!existsSync(soulPath)) {
    error('No .openclaw/ workspace found.');
    console.log();
    console.log(`  ${dim('Run')} ${bold('serpentstack skills')} ${dim('first to download skills and agent configs.')}`);
    console.log();
    process.exit(1);
  }

  // Check for agent definitions
  const agentDirs = discoverAgents(projectDir);
  if (agentDirs.length === 0) {
    error('No agents found in .openclaw/agents/');
    console.log();
    console.log(`  ${dim('Run')} ${bold('serpentstack skills')} ${dim('to download the default agents,')}`);
    console.log(`  ${dim('or create your own at')} ${bold('.openclaw/agents/<name>/AGENT.md')}`);
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
  const [hasOpenClaw, available] = await Promise.all([
    which('openclaw'),
    detectModels(),
  ]);
  spin.stop();

  return { soulPath, parsed, hasOpenClaw, available };
}

/**
 * Print a summary of what's installed and what's missing.
 * Returns true if everything needed to launch is present.
 */
function printPreflightStatus(hasOpenClaw, available) {
  divider('Runtime');
  console.log();

  // OpenClaw
  if (hasOpenClaw) {
    console.log(`    ${green('✓')} OpenClaw ${dim('— persistent agent runtime')}`);
  } else {
    console.log(`    ${red('✗')} OpenClaw ${dim('— not installed')}`);
  }

  // Ollama
  if (available.ollamaRunning) {
    console.log(`    ${green('✓')} Ollama  ${dim(`— running, ${available.local.length} model(s) installed`)}`);
  } else if (available.ollamaInstalled) {
    console.log(`    ${yellow('△')} Ollama  ${dim('— installed but not running')}`);
  } else {
    console.log(`    ${yellow('○')} Ollama  ${dim('— not installed (optional, for free local models)')}`);
  }

  // API key
  if (available.hasApiKey) {
    console.log(`    ${green('✓')} API key ${dim('— configured for cloud models')}`);
  }

  console.log();

  // Actionable guidance for missing pieces
  const issues = [];

  if (!hasOpenClaw) {
    issues.push({
      label: 'Install OpenClaw (required to run agents)',
      cmd: 'npm install -g openclaw@latest',
    });
  }

  if (!available.ollamaInstalled) {
    issues.push({
      label: 'Install Ollama for free local models (recommended)',
      cmd: 'curl -fsSL https://ollama.com/install.sh | sh',
    });
  } else if (!available.ollamaRunning) {
    issues.push({
      label: 'Start Ollama',
      cmd: 'ollama serve',
    });
  }

  if (available.ollamaRunning && available.local.length === 0) {
    issues.push({
      label: 'Pull a model (Ollama is running but has no models)',
      cmd: 'ollama pull llama3.2',
    });
  }

  if (issues.length > 0) {
    for (const issue of issues) {
      console.log(`  ${dim(issue.label + ':')}`);
      console.log(`    ${dim('$')} ${bold(issue.cmd)}`);
      console.log();
    }
  }

  return hasOpenClaw;
}

// ─── Model Install ──────────────────────────────────────────

/**
 * Run `ollama pull <model>` with live progress output.
 * Returns true if the pull succeeded.
 */
function ollamaPull(modelName) {
  return new Promise((resolve) => {
    console.log();
    info(`Downloading ${bold(modelName)}... ${dim('(this may take a few minutes)')}`);
    console.log();

    const child = spawn('ollama', ['pull', modelName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Stream progress to the terminal
    child.stdout.on('data', (data) => {
      const line = data.toString().trim();
      if (line) process.stderr.write(`    ${line}\r`);
    });
    child.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) process.stderr.write(`    ${line}\r`);
    });

    child.on('close', (code) => {
      process.stderr.write('\x1b[K'); // clear the progress line
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

  // Section 2: Downloadable models — always shown if we have recommendations
  if (available.recommended.length > 0) {
    const liveTag = available.recommendedLive
      ? dim(`live from ollama.com`)
      : dim(`cached list`);
    const needsOllama = !available.ollamaInstalled ? dim(' · requires Ollama') : '';
    console.log(`    ${dim('── Download')} ${cyan('free')} ${dim('(')}${liveTag}${needsOllama}${dim(') ──')}`);
    const toShow = available.recommended.slice(0, 8);
    for (const r of toShow) {
      const idx = choices.length;
      const isCurrent = `ollama/${r.name}` === currentModel;
      choices.push({
        id: `ollama/${r.name}`,
        name: r.name,
        params: r.params,
        size: r.size,
        description: r.description,
        tier: 'downloadable',
        action: 'download',
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
    console.log(`    ${dim('$')} ${bold('curl -fsSL https://ollama.com/install.sh | sh')}`);
    console.log(`    ${dim('$')} ${bold('ollama pull llama3.2')}`);
    return currentModel;
  }

  // If current model isn't in any list, append it at the end (never unshift — it breaks numbering)
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

  // If they selected a downloadable model, handle Ollama install + pull
  if (selected.action === 'download') {
    if (!available.ollamaInstalled) {
      console.log();
      warn('Ollama is required to run local models.');
      console.log();
      console.log(`  ${dim('Install Ollama (free, open-source):')}`);
      console.log(`    ${dim('$')} ${bold('curl -fsSL https://ollama.com/install.sh | sh')}`);
      console.log(`    ${dim('$')} ${bold('ollama serve')}`);
      console.log();
      info(`After installing, re-run ${bold('serpentstack persistent --agents')} to download and select ${bold(selected.name)}.`);
      console.log();

      // Save the selection anyway so it's remembered
      return selected.id;
    }

    if (!available.ollamaRunning) {
      console.log();
      warn('Ollama is installed but not running.');
      console.log(`    ${dim('$')} ${bold('ollama serve')}`);
      console.log();
      info(`Start Ollama, then re-run ${bold('serpentstack persistent --agents')} to download ${bold(selected.name)}.`);
      console.log();
      return selected.id;
    }

    rl.pause();
    const pulled = await ollamaPull(selected.name);
    rl.resume();

    if (!pulled) {
      warn(`Download failed. Keeping previous model: ${bold(modelShortName(currentModel))}`);
      return currentModel;
    }
  }

  // Warn about cloud model costs
  if (selected.tier === 'cloud' && (available.local.length > 0 || available.recommended.length > 0)) {
    warn(`Cloud models cost tokens per heartbeat. Consider a local model for persistent agents.`);
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

async function stopAllAgents(projectDir) {
  cleanStalePids(projectDir);
  const running = listPids(projectDir);

  if (running.length === 0) {
    info('No agents are currently running.');
    console.log();
    return 0;
  }

  let stopped = 0;
  for (const { name, pid } of running) {
    // Remove cron jobs for this agent
    try {
      await execPromise('openclaw', ['cron', 'list', '--json']).then(out => {
        const jobs = JSON.parse(out);
        const agentJobs = (Array.isArray(jobs) ? jobs : jobs.jobs || [])
          .filter(j => j.agent === name || (j.name && j.name.startsWith(`${name}-`)));
        return Promise.all(agentJobs.map(j =>
          execPromise('openclaw', ['cron', 'rm', j.id || j.name]).catch(() => {})
        ));
      });
    } catch { /* cron cleanup is best-effort */ }

    // Remove agent from OpenClaw
    try {
      await execPromise('openclaw', ['agents', 'delete', name, '--force']);
    } catch { /* best-effort */ }

    // Clean up PID and workspace
    if (pid > 0) {
      try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
    }
    removePid(projectDir, name);
    cleanWorkspace(projectDir, name);
    success(`Stopped ${bold(name)}`);
    stopped++;
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

  divider('Agents');
  console.log();
  for (const { name, agentMd } of parsed) {
    const statusInfo = getAgentStatus(projectDir, name, config);
    printAgentLine(name, agentMd, config, statusInfo);
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

  // Show recommended models to install
  if (available.recommended.length > 0) {
    divider('Recommended Models');
    console.log();
    if (available.recommendedLive) {
      success(`Fetched latest models from ${cyan('ollama.com/library')}`);
    } else {
      warn(`Could not reach ollama.com — showing cached recommendations`);
    }
    console.log();
    for (const r of available.recommended) {
      console.log(`    ${dim('$')} ${bold(`ollama pull ${r.name}`)}  ${dim(`${r.params} — ${r.description}`)}`);
    }
    console.log();
  }

  // Status summary
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

  config._configured = true;
  writeConfig(projectDir, config);
  success(`Saved ${bold('.openclaw/config.json')}`);
  console.log();
}

// ─── Agents Flow ────────────────────────────────────────────

// Agent description summaries for the enable/disable flow
const AGENT_SUMMARIES = {
  'log-watcher': 'Monitors your dev server health and log output every 30–60s. Catches backend crashes, frontend build errors, and import failures — reports them with file paths and suggested fixes.',
  'test-runner': 'Runs your test suite every 5 min and lint/typecheck every 15 min. Catches regressions before you commit — shows which test failed, what changed, and whether the test or source needs fixing.',
  'skill-maintainer': 'Checks every hour whether your .skills/ files still match the actual codebase. When code patterns drift from what skills describe, it proposes exact updates so IDE agents stay accurate.',
};

async function runAgents(projectDir, config, parsed, available) {
  // Show system capabilities so users know what models they can run
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

      // Show rich description
      console.log(`  ${bold(name)}  ${dim(`(${schedule || 'manual'})`)}`);
      const summary = AGENT_SUMMARIES[name] || agentMd.meta.description || '';
      if (summary) {
        // Word-wrap summary to ~70 chars, indented
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

async function runStart(projectDir, parsed, config, soulPath, hasOpenClaw) {
  if (!hasOpenClaw) {
    error('Cannot launch agents — OpenClaw is not installed.');
    console.log();
    console.log(`  ${dim('$')} ${bold('npm install -g openclaw@latest')}`);
    console.log();
    return;
  }

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
  let registered = 0;

  // Step 1: Generate workspaces and register agents with OpenClaw
  for (const { name, agentMd } of toStart) {
    try {
      const effectiveModel = getEffectiveModel(name, agentMd.meta, config);
      const overriddenMd = {
        ...agentMd,
        meta: { ...agentMd.meta, model: effectiveModel },
      };

      const workspacePath = generateWorkspace(projectDir, name, overriddenMd, sharedSoul);
      const absWorkspace = resolve(workspacePath);

      // Register agent with OpenClaw (idempotent — will update if exists)
      try {
        await execPromise('openclaw', [
          'agents', 'add', name,
          '--workspace', absWorkspace,
          '--model', effectiveModel,
          '--non-interactive',
        ]);
        success(`Registered ${bold(name)} ${dim(`(${modelShortName(effectiveModel)})`)}`);
      } catch (err) {
        // Agent may already exist — that's fine
        if (err.message && err.message.includes('already exists')) {
          info(`${bold(name)} already registered with OpenClaw`);
        } else {
          warn(`Could not register ${bold(name)}: ${err.message || 'unknown error'}`);
        }
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
          // Cron job may already exist — non-fatal
        }
      }

      writePid(projectDir, name, -1); // marker
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

  console.log();

  // Step 2: Check if gateway is running, start it if not
  let gatewayRunning = false;
  try {
    const healthResp = await fetch('http://127.0.0.1:18789/health');
    gatewayRunning = healthResp.ok;
  } catch {
    // not running
  }

  if (!gatewayRunning) {
    info('Starting OpenClaw gateway...');

    const method = openInTerminal(
      'OpenClaw Gateway',
      'openclaw gateway',
      resolve(projectDir),
    );

    if (method) {
      success(`Gateway opened in ${method}`);
    } else {
      // Fallback: start in background
      const child = spawn('openclaw', ['gateway'], {
        stdio: 'ignore',
        detached: true,
        cwd: resolve(projectDir),
      });
      child.unref();
      success(`Gateway started in background ${dim(`(PID ${child.pid})`)}`);
    }

    // Give gateway a moment to start
    console.log(`  ${dim('Waiting for gateway...')}`);
    await new Promise(r => setTimeout(r, 3000));
  } else {
    success('Gateway is already running');
  }

  console.log();
  success(`${registered} agent(s) registered — fangs out 🐍`);
  console.log();

  printBox('Your agents are running', [
    `${dim('The OpenClaw gateway manages your agents on their schedules.')}`,
    `${dim('View agent activity with:')}`,
    '',
    `${dim('$')} ${bold('openclaw tui')}                     ${dim('# interactive terminal UI')}`,
    `${dim('$')} ${bold('openclaw cron list')}                ${dim('# see scheduled tasks')}`,
    `${dim('$')} ${bold('openclaw agents list')}              ${dim('# see registered agents')}`,
    `${dim('$')} ${bold('serpentstack persistent --stop')}    ${dim('# stop all agents')}`,
  ]);
  console.log();
}

// ─── Main Entry Point ───────────────────────────────────────

export async function persistent({ stop = false, configure = false, agents = false, start = false, models = false } = {}) {
  const projectDir = process.cwd();

  printHeader();

  // ── Stop (doesn't need full preflight) ──
  if (stop) {
    cleanStalePids(projectDir);
    await stopAllAgents(projectDir);
    return;
  }

  // ── Full preflight (checks workspace, agents, runtime) ──
  const { soulPath, parsed, hasOpenClaw, available } = await preflight(projectDir);
  cleanStalePids(projectDir);

  // Load config
  let config = readConfig(projectDir) || { project: {}, agents: {} };
  const isConfigured = !!config._configured;

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
    // Show dashboard
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
      `${dim('$')} ${bold('serpentstack persistent --models')}     ${dim('# list & install models')}`,
    ]);
    console.log();
    return;
  }

  // ── First-time setup: guided walkthrough ──

  // Step 0: Show runtime status
  const canLaunch = printPreflightStatus(hasOpenClaw, available);

  if (!canLaunch) {
    console.log(`  ${dim('Install the missing dependencies above, then run:')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack persistent')}`);
    console.log();

    // Still let them configure even without OpenClaw
    const rl = createInterface({ input: stdin, output: stdout });
    let proceed;
    try {
      proceed = await askYesNo(rl, `Continue with project configuration anyway?`, true);
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
