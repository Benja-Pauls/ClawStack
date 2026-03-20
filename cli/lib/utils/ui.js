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

export const info = (msg) => console.log(`${CYAN}\u2022${RESET} ${msg}`);
export const success = (msg) => console.log(`${GREEN}\u2713${RESET} ${msg}`);
export const warn = (msg) => console.log(`${YELLOW}\u25B3${RESET} ${msg}`);
export const error = (msg) => console.error(`${RED}\u2717${RESET} ${msg}`);
export const dim = (msg) => `${DIM}${msg}${RESET}`;
export const bold = (msg) => `${BOLD}${msg}${RESET}`;
export const green = (msg) => `${GREEN}${msg}${RESET}`;
export const yellow = (msg) => `${YELLOW}${msg}${RESET}`;
export const red = (msg) => `${RED}${msg}${RESET}`;
export const cyan = (msg) => `${CYAN}${msg}${RESET}`;
export const magenta = (msg) => `${MAGENTA}${msg}${RESET}`;
export const blue = (msg) => `${BLUE}${msg}${RESET}`;

const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

export function spinner(msg) {
  if (NO_COLOR || !stderr.isTTY) {
    stderr.write(`  ${msg}\n`);
    return { stop(final) { if (final) stderr.write(`  ${final}\n`); } };
  }
  let i = 0;
  const id = setInterval(() => {
    stderr.write(`\r${CYAN}${SPINNER_FRAMES[i++ % SPINNER_FRAMES.length]}${RESET} ${msg}`);
  }, 80);
  return {
    stop(final) {
      clearInterval(id);
      stderr.write(`\r\x1b[K`);
      if (final) console.log(final);
    }
  };
}

export async function confirm(msg) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`${YELLOW}?${RESET} ${msg} ${dim('(y/N)')} `);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

export function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export function printHeader() {
  console.log(`\n  ${BOLD}${GREEN}\u2728 SerpentStack${RESET} ${DIM}v${getVersion()}${RESET}\n`);
}

/**
 * Print a boxed section with a title and content lines.
 * Used for "Next steps" and prompt blocks.
 */
export function printBox(title, lines, { color = GREEN, icon = '\u25B6' } = {}) {
  const maxLen = Math.max(
    title.length + 4,
    ...lines.map(l => stripAnsi(l).length + 4)
  );
  const width = Math.min(Math.max(maxLen, 50), 80);
  const top = `${color}\u250C${'─'.repeat(width)}\u2510${RESET}`;
  const bot = `${color}\u2514${'─'.repeat(width)}\u2518${RESET}`;

  console.log(top);
  console.log(`${color}\u2502${RESET} ${BOLD}${icon} ${title}${RESET}${' '.repeat(Math.max(0, width - stripAnsi(title).length - 3))}${color}\u2502${RESET}`);
  console.log(`${color}\u2502${' '.repeat(width)}${color}\u2502${RESET}`);
  for (const line of lines) {
    const pad = Math.max(0, width - stripAnsi(line).length - 2);
    console.log(`${color}\u2502${RESET}  ${line}${' '.repeat(pad)}${color}\u2502${RESET}`);
  }
  console.log(bot);
}

/**
 * Print a copyable prompt block that the user can paste into their IDE agent.
 * Accepts a single string or an array of lines for multi-line prompts.
 */
export function printPrompt(promptLines, { hint = 'Copy this prompt and paste it into your IDE agent' } = {}) {
  const lines = Array.isArray(promptLines) ? promptLines : [promptLines];
  const maxLineLen = Math.max(...lines.map(l => stripAnsi(l).length));
  const width = Math.min(Math.max(maxLineLen + 6, 50), 90);
  const innerWidth = width - 2;

  console.log();
  console.log(`  ${DIM}\u250C${'─'.repeat(innerWidth)}\u2510${RESET}`);
  for (const line of lines) {
    const pad = Math.max(0, innerWidth - stripAnsi(line).length - 2);
    console.log(`  ${DIM}\u2502${RESET} ${CYAN}${line}${RESET}${' '.repeat(pad)}${DIM}\u2502${RESET}`);
  }
  console.log(`  ${DIM}\u2514${'─'.repeat(innerWidth)}\u2518${RESET}`);
  console.log(`  ${DIM}\u2191 ${hint}${RESET}`);
  console.log();
}

/**
 * File status icon with color.
 */
export function fileIcon(status) {
  switch (status) {
    case 'created': return `${GREEN}\u2713${RESET}`;
    case 'overwritten': return `${CYAN}\u21BB${RESET}`;
    case 'skipped': return `${YELLOW}\u2022${RESET}`;
    case 'failed': return `${RED}\u2717${RESET}`;
    case 'unchanged': return `${DIM}\u2022${RESET}`;
    default: return `${DIM}\u2022${RESET}`;
  }
}

/**
 * Format a file path with its status for display.
 */
export function fileStatus(path, status, detail) {
  const icon = fileIcon(status);
  switch (status) {
    case 'created': return `  ${icon} ${green(path)}`;
    case 'overwritten': return `  ${icon} ${cyan(path)} ${dim('(updated)')}`;
    case 'skipped': return `  ${icon} ${dim(`${path} (${detail || 'exists, skipped'})`)}`;
    case 'failed': return `  ${icon} ${red(path)} ${dim(`\u2014 ${detail}`)}`;
    case 'unchanged': return `  ${icon} ${dim(`${path} (up to date)`)}`;
    default: return `  ${icon} ${path}`;
  }
}

function stripAnsi(str) {
  return str.replace(/\x1b\[\d+m/g, '');
}
