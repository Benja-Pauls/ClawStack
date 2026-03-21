import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

const STATE_ROOT = join(homedir(), '.serpentstack');

/**
 * Parse an AGENT.md file — YAML frontmatter between --- delimiters + markdown body.
 * Returns { meta: { name, description, model, schedule, tools }, body: string }
 */
export function parseAgentMd(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`Invalid AGENT.md format — missing frontmatter: ${filePath}`);
  }

  const meta = parseYamlFrontmatter(match[1]);
  const body = match[2].trim();
  return { meta, body };
}

/**
 * Minimal YAML parser for AGENT.md frontmatter.
 * Handles: scalars, simple lists, and lists of objects (schedule).
 * No external dependencies.
 */
function parseYamlFrontmatter(yaml) {
  const result = {};
  const lines = yaml.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (!line.trim()) { i++; continue; }

    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!keyMatch) { i++; continue; }

    const key = keyMatch[1];
    const inlineValue = keyMatch[2].trim();

    // Check if next lines are list items
    if (!inlineValue && i + 1 < lines.length && lines[i + 1].match(/^\s+-/)) {
      // It's a list
      const items = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+-/)) {
        const itemLine = lines[i].replace(/^\s+-\s*/, '');

        // Check if this is a key: value item (for schedule objects)
        if (itemLine.includes(':')) {
          const obj = {};
          // Parse inline key: value
          const parts = itemLine.match(/(\w[\w-]*):\s*(.*)/);
          if (parts) obj[parts[1]] = parts[2].trim();

          // Check for continuation lines of this object
          i++;
          while (i < lines.length && lines[i].match(/^\s{4,}\w/) && !lines[i].match(/^\s+-/)) {
            const subMatch = lines[i].trim().match(/^(\w[\w-]*):\s*(.*)/);
            if (subMatch) obj[subMatch[1]] = subMatch[2].trim();
            i++;
          }
          items.push(obj);
        } else {
          items.push(itemLine);
          i++;
        }
      }
      result[key] = items;
    } else {
      result[key] = inlineValue;
      i++;
    }
  }

  return result;
}

/**
 * Discover all agents in .openclaw/agents/ directory.
 * Returns array of { name, dir, agentMdPath }
 */
export function discoverAgents(projectDir) {
  const agentsDir = join(projectDir, '.openclaw', 'agents');
  if (!existsSync(agentsDir)) return [];

  const agents = [];
  for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const agentMd = join(agentsDir, entry.name, 'AGENT.md');
    if (existsSync(agentMd)) {
      agents.push({
        name: entry.name,
        dir: join(agentsDir, entry.name),
        agentMdPath: agentMd,
      });
    }
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Generate an OpenClaw runtime workspace for a single agent.
 * Combines the shared SOUL.md with agent-specific config.
 *
 * Creates files in ~/.serpentstack/agents/<project-hash>/<agent-name>/
 * Returns the workspace path.
 */
export function generateWorkspace(projectDir, agentName, agentMd, sharedSoul) {
  const hash = projectHash(projectDir);
  const workspaceDir = join(STATE_ROOT, 'agents', hash, agentName);
  mkdirSync(workspaceDir, { recursive: true });

  // SOUL.md = shared project soul + agent-specific instructions
  const soul = [
    sharedSoul,
    '',
    '---',
    '',
    `# Agent: ${agentMd.meta.name || agentName}`,
    '',
    agentMd.meta.description ? `> ${agentMd.meta.description}` : '',
    '',
    agentMd.body,
  ].filter(Boolean).join('\n');

  writeFileSync(join(workspaceDir, 'SOUL.md'), soul, 'utf8');

  // HEARTBEAT.md = generated from schedule frontmatter
  const heartbeat = generateHeartbeat(agentMd.meta.schedule || []);
  writeFileSync(join(workspaceDir, 'HEARTBEAT.md'), heartbeat, 'utf8');

  // AGENTS.md = generated from model and tools frontmatter
  const agentsConfig = generateAgentsConfig(agentMd.meta);
  writeFileSync(join(workspaceDir, 'AGENTS.md'), agentsConfig, 'utf8');

  return workspaceDir;
}

function generateHeartbeat(schedule) {
  const lines = ['# Heartbeat Schedule', ''];

  if (schedule.length === 0) {
    lines.push('No scheduled checks configured.');
    return lines.join('\n');
  }

  for (const entry of schedule) {
    const interval = entry.every || 'unknown';
    const task = entry.task || entry.check || 'unnamed-task';
    lines.push(`## Every ${interval}: ${task}`);
    lines.push('');
    lines.push(`Run the \`${task}\` check as defined in the agent instructions.`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateAgentsConfig(meta) {
  const model = meta.model || 'ollama/llama3.2';
  const tools = meta.tools || ['file-system', 'shell', 'git'];

  return [
    '# Agent Configuration',
    '',
    '## Workspace',
    '',
    '```yaml',
    `name: ${meta.name || 'unnamed-agent'}`,
    `description: ${meta.description || 'Persistent agent'}`,
    'workspace: .',
    '```',
    '',
    '## Model',
    '',
    '```yaml',
    `primary_model: ${model}`,
    `heartbeat_model: ${model}`,
    '```',
    '',
    '## Tool Access',
    '',
    ...tools.map(t => `- **${t}**`),
    '',
    '## Operating Rules',
    '',
    '1. Read `.skills/` on startup — follow project conventions.',
    '2. Notify before fixing — report issues with context.',
    '3. Run verification after changes.',
    '4. Keep memory lean.',
    '',
  ].join('\n');
}

// ─── PID Management ──────────────────────────────────────────

/**
 * Write a PID file for a running agent.
 */
export function writePid(projectDir, agentName, pid) {
  const pidDir = join(STATE_ROOT, 'pids', projectHash(projectDir));
  mkdirSync(pidDir, { recursive: true });
  writeFileSync(join(pidDir, `${agentName}.pid`), String(pid), 'utf8');
}

/**
 * Read the PID for a running agent. Returns null if not found.
 */
export function readPid(projectDir, agentName) {
  const pidFile = join(STATE_ROOT, 'pids', projectHash(projectDir), `${agentName}.pid`);
  if (!existsSync(pidFile)) return null;
  const pid = parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
  return isNaN(pid) ? null : pid;
}

/**
 * Remove the PID file for an agent.
 */
export function removePid(projectDir, agentName) {
  const pidFile = join(STATE_ROOT, 'pids', projectHash(projectDir), `${agentName}.pid`);
  if (existsSync(pidFile)) unlinkSync(pidFile);
}

/**
 * List all agents with PID files for this project.
 * Returns array of { name, pid }
 */
export function listPids(projectDir) {
  const pidDir = join(STATE_ROOT, 'pids', projectHash(projectDir));
  if (!existsSync(pidDir)) return [];

  return readdirSync(pidDir)
    .filter(f => f.endsWith('.pid'))
    .map(f => {
      const name = f.replace('.pid', '');
      const pid = readPid(projectDir, name);
      return pid ? { name, pid } : null;
    })
    .filter(Boolean);
}

/**
 * Check if a process is alive.
 */
export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up PID files for dead processes.
 */
export function cleanStalePids(projectDir) {
  for (const { name, pid } of listPids(projectDir)) {
    if (!isProcessAlive(pid)) {
      removePid(projectDir, name);
    }
  }
}

/**
 * Clean up generated workspace files for an agent.
 */
export function cleanWorkspace(projectDir, agentName) {
  const hash = projectHash(projectDir);
  const workspaceDir = join(STATE_ROOT, 'agents', hash, agentName);
  if (existsSync(workspaceDir)) {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function projectHash(projectDir) {
  const absolute = resolve(projectDir);
  return createHash('sha256').update(absolute).digest('hex').slice(0, 12);
}
