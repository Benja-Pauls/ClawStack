import { createInterface } from 'node:readline/promises';
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

const SPINNER_FRAMES = ['◐', '◓', '◑', '◒'];

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
    console.log(`  ${DIM}──${RESET} ${GREEN}${BOLD}${label}${RESET} ${DIM}${'─'.repeat(Math.max(0, 50 - stripAnsi(label).length))}${RESET}`);
  } else {
    console.log(`  ${DIM}${'─'.repeat(54)}${RESET}`);
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

  console.log(`  ${DIM}┌${'─'.repeat(width)}┐${RESET}`);
  console.log(`  ${DIM}│${RESET} ${BOLD}${icon} ${title}${RESET}${' '.repeat(Math.max(0, width - stripAnsi(title).length - 3))}${DIM}│${RESET}`);
  console.log(`  ${DIM}│${' '.repeat(width)}│${RESET}`);
  for (const line of lines) {
    const pad = Math.max(0, width - stripAnsi(line).length - 2);
    console.log(`  ${DIM}│${RESET}  ${line}${' '.repeat(pad)}${DIM}│${RESET}`);
  }
  console.log(`  ${DIM}└${'─'.repeat(width)}┘${RESET}`);
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
  console.log(`  ${DIM}┌${'─'.repeat(innerWidth)}┐${RESET}`);
  for (const line of lines) {
    const pad = Math.max(0, innerWidth - stripAnsi(line).length - 2);
    console.log(`  ${DIM}│${RESET} ${CYAN}${line}${RESET}${' '.repeat(pad)}${DIM}│${RESET}`);
  }
  console.log(`  ${DIM}└${'─'.repeat(innerWidth)}┘${RESET}`);
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

// ─── Utilities ───────────────────────────────────────────────

export function stripAnsi(str) {
  return str.replace(/\x1b\[[\d;]*m/g, '');
}
