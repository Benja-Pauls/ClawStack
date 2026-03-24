import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { readFileSync } from 'node:fs';
import { stdin, stdout, stderr } from 'node:process';

const NO_COLOR = !!process.env.NO_COLOR || !stdout.isTTY;

const c = (code) => NO_COLOR ? '' : `\x1b[${code}m`;
const RESET = c(0);
const BOLD = c(1);
const DIM = c(2);
const ITALIC = c(3);
const RED = c(31);
const GREEN = c(32);
const YELLOW = c(33);
const BLUE = c(34);
const MAGENTA = c(35);
const CYAN = c(36);
const BG_DIM = c(100);

// ─── Brand ───────────────────────────────────────────────────

const SNAKE = '🐍';
const BRAND_COLOR = GREEN;

// ─── Text formatters ─────────────────────────────────────────

export const info = (msg) => console.log(`  ${CYAN}•${RESET} ${msg}`);
export const success = (msg) => console.log(`  ${GREEN}✓${RESET} ${msg}`);
export const warn = (msg) => console.log(`  ${YELLOW}△${RESET} ${msg}`);
export const error = (msg) => console.error(`  ${RED}✗${RESET} ${msg}`);
export const dim = (msg) => `${DIM}${msg}${RESET}`;
export const bold = (msg) => `${BOLD}${msg}${RESET}`;
export const green = (msg) => `${GREEN}${msg}${RESET}`;
export const yellow = (msg) => `${YELLOW}${msg}${RESET}`;
export const red = (msg) => `${RED}${msg}${RESET}`;
export const cyan = (msg) => `${CYAN}${msg}${RESET}`;
export const magenta = (msg) => `${MAGENTA}${msg}${RESET}`;
export const blue = (msg) => `${BLUE}${msg}${RESET}`;

// ─── Spinner ─────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function spinner(msg) {
  if (NO_COLOR || !stderr.isTTY) {
    stderr.write(`  ${msg}\n`);
    return { stop(final) { if (final) stderr.write(`  ${final}\n`); }, update() {} };
  }
  let i = 0;
  let currentMsg = msg;
  const id = setInterval(() => {
    stderr.write(`\r  ${GREEN}${SPINNER_FRAMES[i++ % SPINNER_FRAMES.length]}${RESET} ${currentMsg}`);
  }, 100);
  return {
    update(newMsg) { currentMsg = newMsg; },
    stop(final) {
      clearInterval(id);
      stderr.write(`\r\x1b[K`);
      if (final) console.log(final);
    }
  };
}

// ─── Confirm ─────────────────────────────────────────────────

export async function confirm(msg) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${YELLOW}?${RESET} ${msg} ${DIM}(y/N)${RESET} `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

// ─── Version ─────────────────────────────────────────────────

export function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

// ─── Headers & Dividers ──────────────────────────────────────

export function printHeader() {
  console.log();
  console.log(`  ${SNAKE} ${BOLD}${GREEN}SerpentStack${RESET} ${DIM}v${getVersion()}${RESET}`);
  console.log();
}

export function divider(label) {
  if (label) {
    console.log(`  ${GREEN}──${RESET} ${GREEN}${BOLD}${label}${RESET} ${DIM}${'─'.repeat(Math.max(0, 50 - stripAnsi(label).length))}${RESET}`);
  } else {
    console.log(`  ${GREEN}──${DIM}${'─'.repeat(52)}${RESET}`);
  }
}

// ─── Boxes ───────────────────────────────────────────────────

/**
 * Print a boxed section with a title and content lines.
 */
export function printBox(title, lines, { color = GREEN, icon = '▶' } = {}) {
  const allText = [title, ...lines];
  const maxLen = Math.max(...allText.map(l => stripAnsi(l).length + 4));
  const width = Math.min(Math.max(maxLen, 50), 80);

  console.log(`  ${GREEN}╭${DIM}${'─'.repeat(width)}${GREEN}╮${RESET}`);
  console.log(`  ${GREEN}│${RESET} ${BOLD}${icon} ${title}${RESET}${' '.repeat(Math.max(0, width - stripAnsi(title).length - 3))}${GREEN}│${RESET}`);
  console.log(`  ${GREEN}│${DIM}${' '.repeat(width)}${GREEN}│${RESET}`);
  for (const line of lines) {
    const pad = Math.max(0, width - stripAnsi(line).length - 2);
    console.log(`  ${GREEN}│${RESET}  ${line}${' '.repeat(pad)}${GREEN}│${RESET}`);
  }
  console.log(`  ${GREEN}╰${DIM}${'─'.repeat(width)}${GREEN}╯${RESET}`);
}

/**
 * Print a copyable prompt block.
 */
export function printPrompt(promptLines, { hint = 'Copy this prompt and paste it into your IDE agent' } = {}) {
  const lines = Array.isArray(promptLines) ? promptLines : [promptLines];
  const maxLineLen = Math.max(...lines.map(l => stripAnsi(l).length));
  const width = Math.min(Math.max(maxLineLen + 6, 50), 90);
  const innerWidth = width - 2;

  console.log();
  console.log(`  ${GREEN}╭${DIM}${'─'.repeat(innerWidth)}${GREEN}╮${RESET}`);
  for (const line of lines) {
    const pad = Math.max(0, innerWidth - stripAnsi(line).length - 2);
    console.log(`  ${GREEN}│${RESET} ${CYAN}${line}${RESET}${' '.repeat(pad)}${GREEN}│${RESET}`);
  }
  console.log(`  ${GREEN}╰${DIM}${'─'.repeat(innerWidth)}${GREEN}╯${RESET}`);
  console.log(`  ${DIM}↑ ${hint}${RESET}`);
  console.log();
}

// ─── File Status ─────────────────────────────────────────────

export function fileIcon(status) {
  switch (status) {
    case 'created': return `${GREEN}✓${RESET}`;
    case 'overwritten': return `${CYAN}↻${RESET}`;
    case 'skipped': return `${YELLOW}•${RESET}`;
    case 'failed': return `${RED}✗${RESET}`;
    case 'unchanged': return `${DIM}•${RESET}`;
    default: return `${DIM}•${RESET}`;
  }
}

export function fileStatus(path, status, detail) {
  const icon = fileIcon(status);
  switch (status) {
    case 'created': return `    ${icon} ${path}`;
    case 'overwritten': return `    ${icon} ${cyan(path)} ${dim('(updated)')}`;
    case 'skipped': return `    ${icon} ${dim(`${path} (${detail || 'exists, skipped'})`)}`;
    case 'failed': return `    ${icon} ${red(path)} ${dim(`— ${detail}`)}`;
    case 'unchanged': return `    ${icon} ${dim(`${path} (up to date)`)}`;
    default: return `    ${icon} ${path}`;
  }
}

// ─── Snake List ─────────────────────────────────────────────

/**
 * Render a list with a serpentine body connector (╭│╰) in brand green.
 * Lines with leading whitespace are auto-trimmed; the connector adds its own indent.
 */
export function printSnakeList(lines, { indent = 2 } = {}) {
  const filtered = lines.filter(Boolean);
  if (filtered.length === 0) return;

  const pad = ' '.repeat(indent);

  for (let i = 0; i < filtered.length; i++) {
    let connector;
    if (filtered.length === 1) {
      connector = '╶';
    } else if (i === 0) {
      connector = '╭';
    } else if (i === filtered.length - 1) {
      connector = '╰';
    } else {
      connector = '│';
    }

    const line = filtered[i].replace(/^\s+/, '');
    console.log(`${pad}${GREEN}${connector}${RESET} ${line}`);
  }
}

// ─── Interactive Select ─────────────────────────────────────

/**
 * Arrow-key interactive selection. Falls back to numbered input on non-TTY.
 *
 * @param {Array<{label: string, value: any, hint?: string} | {separator: string}>} items
 *   Selectable options or non-selectable section headers.
 * @param {object} [opts]
 * @param {any}    [opts.defaultValue] - value to pre-highlight
 * @param {import('node:readline/promises').Interface} [opts.rl] - existing readline to pause/resume
 * @returns {Promise<any>} the `.value` of the selected item
 */
export async function select(items, { defaultValue, rl: existingRl } = {}) {
  const selectableItems = items.filter(i => !('separator' in i));

  if (selectableItems.length === 0) return undefined;

  const defaultIdx = Math.max(0, selectableItems.findIndex(s => s.value === defaultValue));

  // ── Non-TTY fallback: numbered list ──
  if (NO_COLOR || !stdout.isTTY || !stdin.isTTY) {
    let num = 0;
    for (const item of items) {
      if ('separator' in item) {
        console.log(`    ${item.separator}`);
      } else {
        num++;
        const isCurrent = selectableItems.indexOf(item) === defaultIdx;
        const marker = isCurrent ? `${GREEN}>${RESET}` : ' ';
        console.log(`  ${marker} ${DIM}${num}.${RESET} ${item.label}${item.hint || ''}`);
      }
    }
    console.log();

    const fallbackRl = existingRl || createInterface({ input: stdin, output: stdout });
    try {
      const answer = await fallbackRl.question(
        `    ${DIM}Enter 1-${selectableItems.length} [${defaultIdx + 1}]:${RESET} `,
      );
      const idx = parseInt(answer.trim(), 10) - 1;
      return (idx >= 0 && idx < selectableItems.length)
        ? selectableItems[idx].value
        : selectableItems[defaultIdx].value;
    } finally {
      if (!existingRl) fallbackRl.close();
    }
  }

  // ── Interactive TTY mode ──
  if (existingRl) existingRl.pause();

  let cursor = defaultIdx;

  function buildLines() {
    const out = [];
    for (const item of items) {
      if ('separator' in item) {
        out.push(`    ${item.separator}`);
      } else {
        const idx = selectableItems.indexOf(item);
        const active = idx === cursor;
        const prefix = active ? `${GREEN}❯${RESET}` : ' ';
        const label = active ? `${GREEN}${BOLD}${item.label}${RESET}` : item.label;
        const hint = item.hint ? ` ${item.hint}` : '';
        out.push(`  ${prefix} ${label}${hint}`);
      }
    }
    out.push('');
    out.push(`  ${DIM}↑/↓ navigate · enter select${RESET}`);
    return out;
  }

  let lineCount = 0;

  function render(initial = false) {
    if (!initial && lineCount > 0) {
      stdout.write(`\x1b[${lineCount}A`);
    }
    const out = buildLines();
    lineCount = out.length;
    for (const line of out) {
      stdout.write(`\x1b[2K${line}\n`);
    }
  }

  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();

  render(true);

  return new Promise((resolve) => {
    function onKeypress(_str, key) {
      if (!key) return;

      if (key.name === 'up' || key.name === 'k') {
        cursor = (cursor - 1 + selectableItems.length) % selectableItems.length;
        render();
      } else if (key.name === 'down' || key.name === 'j') {
        cursor = (cursor + 1) % selectableItems.length;
        render();
      } else if (key.name === 'return') {
        finish(selectableItems[cursor].value);
      } else if (key.name === 'escape') {
        finish(selectableItems[defaultIdx].value);
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        stdout.write('\n');
        process.exit(0);
      }
    }

    function cleanup() {
      stdin.removeListener('keypress', onKeypress);
      try { stdin.setRawMode(false); } catch {}
      stdin.pause();
      if (existingRl) existingRl.resume();
    }

    function finish(value) {
      cleanup();
      stdout.write(`\x1b[${lineCount}A`);
      const selected = selectableItems.find(s => s.value === value);
      stdout.write(`\x1b[2K  ${GREEN}✓${RESET} ${selected?.label || value}\n`);
      stdout.write('\x1b[J');
      resolve(value);
    }

    stdin.on('keypress', onKeypress);
  });
}

// ─── Utilities ───────────────────────────────────────────────

export function stripAnsi(str) {
  return str.replace(/\x1b\[[\d;]*m/g, '');
}
