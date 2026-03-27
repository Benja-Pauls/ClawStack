import { existsSync, readdirSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import {
  info, success, warn, error,
  bold, dim, green, cyan, yellow, red, magenta,
  printHeader, divider,
} from '../utils/ui.js';

const NOTIFICATIONS_DIR = join(homedir(), '.serpentstack', 'notifications');

// ─── Notification parsing ───────────────────────────────────

/**
 * Parse a notification file with YAML frontmatter + markdown body.
 * Expected format:
 * ---
 * agent: log-watcher
 * severity: error|warning|info
 * project: my-app
 * timestamp: 2026-03-26T10:30:00Z
 * file: src/app.py
 * ---
 * # Title
 * Body content...
 */
function parseNotification(filepath) {
  const raw = readFileSync(filepath, 'utf8');
  const name = basename(filepath, '.md');

  // Parse YAML frontmatter
  const meta = {};
  let body = raw;

  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (fmMatch) {
    const yamlBlock = fmMatch[1];
    body = fmMatch[2].trim();

    for (const line of yamlBlock.split('\n')) {
      const [key, ...valParts] = line.split(':');
      if (key && valParts.length) {
        meta[key.trim()] = valParts.join(':').trim();
      }
    }
  }

  // Extract timestamp from filename if not in frontmatter
  // Format: <unix-timestamp>-<agent-name>.md
  const tsMatch = name.match(/^(\d+)-/);
  const fileTimestamp = tsMatch ? parseInt(tsMatch[1], 10) * 1000 : null;

  return {
    file: filepath,
    name,
    agent: meta.agent || name.replace(/^\d+-/, ''),
    severity: meta.severity || 'info',
    project: meta.project || '',
    timestamp: meta.timestamp ? new Date(meta.timestamp) : (fileTimestamp ? new Date(fileTimestamp) : new Date()),
    sourceFile: meta.file || '',
    body,
    raw,
  };
}

// ─── Severity formatting ────────────────────────────────────

const SEVERITY_COLORS = {
  error: s => red(s),
  warning: s => yellow(s),
  info: s => cyan(s),
};

const SEVERITY_ICONS = {
  error: '✗',
  warning: '!',
  info: '•',
};

function formatSeverity(severity) {
  const colorFn = SEVERITY_COLORS[severity] || dim;
  const icon = SEVERITY_ICONS[severity] || '•';
  return colorFn(`${icon} ${severity}`);
}

// ─── Agent formatting ───────────────────────────────────────

const AGENT_COLORS = {
  'log-watcher': s => red(s),
  'test-runner': s => yellow(s),
  'skill-maintainer': s => magenta(s),
};

function formatAgent(agent) {
  const colorFn = AGENT_COLORS[agent] || cyan;
  return colorFn(agent);
}

// ─── Time formatting ────────────────────────────────────────

function timeAgo(date) {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString();
}

// ─── Commands ───────────────────────────────────────────────

function loadNotifications() {
  if (!existsSync(NOTIFICATIONS_DIR)) return [];

  const files = readdirSync(NOTIFICATIONS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => join(NOTIFICATIONS_DIR, f));

  return files
    .map(f => {
      try { return parseNotification(f); }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp); // newest first
}

function listNotifications({ agent, severity, limit = 20 } = {}) {
  let notifications = loadNotifications();

  if (agent) {
    notifications = notifications.filter(n => n.agent === agent);
  }
  if (severity) {
    notifications = notifications.filter(n => n.severity === severity);
  }

  if (notifications.length === 0) {
    info('No notifications.');
    console.log();
    if (!existsSync(NOTIFICATIONS_DIR)) {
      console.log(`  ${dim('Persistent agents write notifications to:')}`);
      console.log(`    ${dim(NOTIFICATIONS_DIR)}`);
      console.log();
      console.log(`  ${dim('Start agents with:')} ${bold('serpentstack persistent --start')}`);
    } else {
      console.log(`  ${dim('Your agents haven\'t reported anything yet.')}`);
      console.log(`  ${dim('Check agent status:')} ${bold('serpentstack persistent')}`);
    }
    console.log();
    return;
  }

  const shown = notifications.slice(0, limit);
  const remaining = notifications.length - shown.length;

  // Summary counts
  const counts = { error: 0, warning: 0, info: 0 };
  for (const n of notifications) {
    counts[n.severity] = (counts[n.severity] || 0) + 1;
  }

  const countStr = [
    counts.error ? red(`${counts.error} errors`) : null,
    counts.warning ? yellow(`${counts.warning} warnings`) : null,
    counts.info ? dim(`${counts.info} info`) : null,
  ].filter(Boolean).join(dim(' · '));

  console.log(`  ${countStr}  ${dim(`(${notifications.length} total)`)}`);
  console.log();

  for (const n of shown) {
    const sev = formatSeverity(n.severity);
    const ag = formatAgent(n.agent);
    const time = dim(timeAgo(n.timestamp));

    // First line: severity + agent + time
    console.log(`  ${sev}  ${ag}  ${time}`);

    // Body preview (first non-empty, non-heading line)
    const preview = getPreview(n.body);
    if (preview) {
      console.log(`  ${dim(preview)}`);
    }

    if (n.sourceFile) {
      console.log(`  ${dim('→ ' + n.sourceFile)}`);
    }

    console.log();
  }

  if (remaining > 0) {
    console.log(`  ${dim(`... and ${remaining} more. Use --limit ${limit + 20} to see more.`)}`);
    console.log();
  }

  console.log(`  ${dim('Read full detail:')}   ${bold('serpentstack notifications --read <index>')}`);
  console.log(`  ${dim('Clear all:')}          ${bold('serpentstack notifications --clear')}`);
  console.log(`  ${dim('Filter by agent:')}    ${bold('serpentstack notifications --agent log-watcher')}`);
  console.log(`  ${dim('Filter by severity:')} ${bold('serpentstack notifications --errors')}`);
  console.log();
}

function getPreview(body) {
  const lines = body.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
  const first = lines[0]?.trim();
  if (!first) return null;
  return first.length > 80 ? first.slice(0, 77) + '...' : first;
}

function readNotification(index) {
  const notifications = loadNotifications();

  if (index < 1 || index > notifications.length) {
    error(`Invalid index. There are ${notifications.length} notifications.`);
    console.log();
    return;
  }

  const n = notifications[index - 1];
  const sev = formatSeverity(n.severity);
  const ag = formatAgent(n.agent);
  const time = n.timestamp.toLocaleString();

  divider(`${n.agent} · ${n.severity}`);
  console.log();
  console.log(`  ${dim('Agent:')}    ${ag}`);
  console.log(`  ${dim('Severity:')} ${sev}`);
  console.log(`  ${dim('Time:')}     ${dim(time)}`);
  if (n.project) console.log(`  ${dim('Project:')}  ${n.project}`);
  if (n.sourceFile) console.log(`  ${dim('File:')}     ${n.sourceFile}`);
  console.log();

  // Print body with indent
  for (const line of n.body.split('\n')) {
    console.log(`  ${line}`);
  }
  console.log();

  console.log(`  ${dim('Source: ' + n.file)}`);
  console.log();
}

function clearNotifications({ agent } = {}) {
  if (!existsSync(NOTIFICATIONS_DIR)) {
    info('Nothing to clear.');
    console.log();
    return;
  }

  const files = readdirSync(NOTIFICATIONS_DIR).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    info('Nothing to clear.');
    console.log();
    return;
  }

  let cleared = 0;
  for (const f of files) {
    if (agent && !f.includes(agent)) continue;
    try {
      unlinkSync(join(NOTIFICATIONS_DIR, f));
      cleared++;
    } catch { /* ignore */ }
  }

  success(`Cleared ${bold(String(cleared))} notification${cleared === 1 ? '' : 's'}.`);
  console.log();
}

// ─── Main entry point ───────────────────────────────────────

export async function notifications(flags = {}) {
  printHeader();

  // Ensure directory exists
  mkdirSync(NOTIFICATIONS_DIR, { recursive: true });

  if (flags.clear) {
    clearNotifications({ agent: flags.agent });
    return;
  }

  if (flags.read) {
    const index = parseInt(flags.read, 10);
    if (isNaN(index)) {
      error('Provide a notification number: --read 1');
      console.log();
      return;
    }
    readNotification(index);
    return;
  }

  // Default: list notifications
  listNotifications({
    agent: flags.agent,
    severity: flags.errors ? 'error' : flags.warnings ? 'warning' : undefined,
    limit: flags.limit ? parseInt(flags.limit, 10) : 20,
  });
}
