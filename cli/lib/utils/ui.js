import { createInterface } from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { stdin, stdout, stderr } from 'node:process';

const NO_COLOR = !!process.env.NO_COLOR || !stdout.isTTY;

const c = (code) => NO_COLOR ? '' : `\x1b[${code}m`;
const RESET = c(0);
const BOLD = c(1);
const DIM = c(2);
const RED = c(31);
const GREEN = c(32);
const YELLOW = c(33);
const CYAN = c(36);

export const info = (msg) => console.log(`${CYAN}i${RESET} ${msg}`);
export const success = (msg) => console.log(`${GREEN}\u2713${RESET} ${msg}`);
export const warn = (msg) => console.log(`${YELLOW}!${RESET} ${msg}`);
export const error = (msg) => console.error(`${RED}\u2717${RESET} ${msg}`);
export const dim = (msg) => `${DIM}${msg}${RESET}`;
export const bold = (msg) => `${BOLD}${msg}${RESET}`;

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
  console.log(`\n  ${BOLD}${CYAN}\u2728 SerpentStack${RESET} ${DIM}v${getVersion()}${RESET}\n`);
}
