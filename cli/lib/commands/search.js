import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { searchAll } from '../utils/registries.js';
import { add as addSkill } from './add.js';
import {
  info, success, warn, error,
  bold, dim, green, cyan, yellow, magenta,
  divider, printHeader, spinner, printSnakeList,
} from '../utils/ui.js';

// ─── Source badges ──────────────────────────────────────────

const SOURCE_BADGE = {
  'anthropic':            magenta('anthropic'),
  'skills.sh':            cyan('skills.sh'),
  'awesome-agent-skills': green('awesome'),
  'github':               dim('github'),
};

function sourceBadge(source) {
  return SOURCE_BADGE[source] || dim(source);
}

function starsLabel(stars) {
  if (!stars && stars !== 0) return '';
  if (stars >= 1000) return dim(` ${(stars / 1000).toFixed(1)}k\u2605`);
  if (stars > 0) return dim(` ${stars}\u2605`);
  return '';
}

// ─── Non-interactive fallback ───────────────────────────────

function printStaticResults(results, sources, query) {
  const sourceList = sources.names.join(', ');
  const sourceCount = sources.names.length;

  console.log();
  divider(`${results.length} results for "${query}"`);
  info(`Searched ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}: ${dim(sourceList)}`);
  if (sources.failed > 0) {
    warn(`${sources.failed} ${sources.failed === 1 ? 'source' : 'sources'} unreachable`);
  }
  console.log();

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const num = dim(`${String(i + 1).padStart(2)}.`);
    const badge = sourceBadge(r.source);
    const stars = starsLabel(r.stars);
    const desc = r.description ? `\n      ${dim(r.description)}` : '';
    const install = `\n      ${dim('$')} ${dim(r.install)}`;
    console.log(`${num} ${bold(r.name)}  ${badge}${stars}${desc}${install}`);
    if (i < results.length - 1) console.log();
  }

  console.log();
  console.log(`  ${dim('Sources:')} ${magenta('anthropic')} ${dim('official')}  ${cyan('skills.sh')} ${dim('Vercel')}  ${green('awesome')} ${dim('curated')}  ${dim('github community')}`);
  console.log();
}

// ─── Interactive result browser ─────────────────────────────

const NO_COLOR = !!process.env.NO_COLOR || !stdout.isTTY;

function interactiveBrowser(results, sources, query) {
  return new Promise((resolve) => {
    let cursor = 0;
    let lineCount = 0;
    const maxVisible = Math.min(results.length, 12); // Show 12 results at a time

    function getVisibleWindow() {
      // Scroll window to keep cursor visible
      let start = 0;
      if (cursor >= maxVisible) {
        start = cursor - maxVisible + 1;
      }
      return { start, end: Math.min(start + maxVisible, results.length) };
    }

    function buildLines() {
      const out = [];
      const { start, end } = getVisibleWindow();

      // Scroll indicator at top
      if (start > 0) {
        out.push(`  ${dim(`  ↑ ${start} more above`)}`);
      }

      for (let i = start; i < end; i++) {
        const r = results[i];
        const active = i === cursor;
        const badge = sourceBadge(r.source);
        const stars = starsLabel(r.stars);

        if (active) {
          out.push(`  ${green('❯')} ${green(bold(r.name))}  ${badge}${stars}`);
          if (r.description) {
            out.push(`    ${dim(r.description)}`);
          }
          out.push(`    ${dim('$')} ${cyan(r.install)}`);
        } else {
          out.push(`    ${dim(r.name)}  ${badge}${stars}`);
        }
      }

      // Scroll indicator at bottom
      const remaining = results.length - end;
      if (remaining > 0) {
        out.push(`  ${dim(`  ↓ ${remaining} more below`)}`);
      }

      out.push('');
      out.push(`  ${dim('↑/↓ browse · enter install · o open · q quit')}`);

      return out;
    }

    function render(initial = false) {
      if (!initial && lineCount > 0) {
        stdout.write(`\x1b[${lineCount}A`);
      }
      const lines = buildLines();
      lineCount = lines.length;
      for (const line of lines) {
        stdout.write(`\x1b[2K${line}\n`);
      }
    }

    function cleanup() {
      stdin.removeListener('keypress', onKeypress);
      try { stdin.setRawMode(false); } catch {}
      stdin.pause();
    }

    function finish(action) {
      cleanup();
      // Clear the interactive display
      stdout.write(`\x1b[${lineCount}A`);
      stdout.write('\x1b[J');
      resolve(action);
    }

    function onKeypress(_str, key) {
      if (!key) return;

      if (key.name === 'up' || key.name === 'k') {
        cursor = (cursor - 1 + results.length) % results.length;
        render();
      } else if (key.name === 'down' || key.name === 'j') {
        cursor = (cursor + 1) % results.length;
        render();
      } else if (key.name === 'return') {
        finish({ type: 'install', result: results[cursor] });
      } else if (_str === 'o' || _str === 'O') {
        finish({ type: 'open', result: results[cursor] });
      } else if (key.name === 'escape' || _str === 'q' || _str === 'Q') {
        finish({ type: 'quit' });
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        stdout.write('\n');
        process.exit(0);
      }
    }

    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();

    render(true);
    stdin.on('keypress', onKeypress);
  });
}

// ─── Install skill ──────────────────────────────────────────

async function installSkill(result) {
  // For skills.sh sources, show the install command and copy to clipboard
  if (result.source === 'skills.sh' || result.source === 'anthropic') {
    info(`This skill installs via skills.sh:`);
    console.log();
    console.log(`    ${dim('$')} ${bold(result.install)}`);
    console.log();

    // Copy to clipboard if possible
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const exec = promisify(execFile);
      if (process.platform === 'darwin') {
        await exec('pbcopy', [], { input: result.install });
        success('Copied to clipboard');
      } else {
        await exec('xclip', ['-selection', 'clipboard'], { input: result.install });
        success('Copied to clipboard');
      }
    } catch {
      // Clipboard not available — that's fine
    }
    console.log();
    return;
  }

  // For awesome-agent-skills and GitHub, use the add command
  const repoName = result.name.includes('/') ? result.name : `${result.author}/${result.name}`;

  // Build full repo path from URL if available
  let source = repoName;
  if (result.url?.includes('github.com/')) {
    source = result.url.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
    // Strip /tree/main suffix for clean paths
    source = source.replace(/\/tree\/(main|master)$/, '');
  }

  await addSkill(source);
}

// ─── Open in browser ────────────────────────────────────────

async function openUrl(url) {
  const { execFile } = await import('node:child_process');
  if (process.platform === 'darwin') {
    execFile('open', [url]);
  } else if (process.platform === 'linux') {
    execFile('xdg-open', [url]);
  } else if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', url]);
  }
}

// ─── Search command ─────────────────────────────────────────

export async function search(query) {
  if (!query || query.trim().length === 0) {
    printHeader();
    console.log();
    error('Missing search query.');
    console.log();
    console.log(`  ${dim('Usage:')} ${bold('serpentstack search')} ${dim('<query>')}`);
    console.log();
    console.log(`  ${dim('Examples:')}`);
    printSnakeList([
      `${cyan('serpentstack search')} ${dim('"react testing"')}`,
      `${cyan('serpentstack search')} ${dim('"auth oauth"')}`,
      `${cyan('serpentstack search')} ${dim('"terraform aws"')}`,
      `${cyan('serpentstack search')} ${dim('"stripe payments"')}`,
      `${cyan('serpentstack search')} ${dim('"docker deploy"')}`,
    ]);
    console.log();
    return;
  }

  printHeader();

  const spin = spinner(`Slithering through registries for ${bold(query)}...`);

  let data;
  try {
    data = await searchAll(query, { limit: 20 });
  } catch (err) {
    spin.stop();
    error(`Search failed: ${err.message}`);
    console.log();
    return;
  }

  const { results, sources } = data;

  // Build status line
  const sourceList = sources.names.join(', ');
  const sourceCount = sources.names.length;

  if (results.length === 0) {
    spin.stop();
    console.log();
    divider(`No results for "${query}"`);
    console.log();
    if (sourceCount > 0) {
      info(`Searched ${sourceCount} ${sourceCount === 1 ? 'registry' : 'registries'}: ${dim(sourceList)}`);
    }
    if (sources.failed > 0) {
      warn(`${sources.failed} ${sources.failed === 1 ? 'registry' : 'registries'} unreachable`);
    }
    console.log();
    console.log(`  ${dim('Try broader terms, or browse directly:')}`);
    printSnakeList([
      `${cyan('https://skills.sh')}              ${dim('Vercel skill leaderboard')}`,
      `${cyan('https://skillsmp.com')}            ${dim('500K+ indexed skills')}`,
      `${cyan('https://github.com/anthropics/skills')} ${dim('Anthropic official')}`,
    ]);
    console.log();
    return;
  }

  spin.stop();

  // Non-TTY: static list with full details
  if (NO_COLOR || !stdout.isTTY || !stdin.isTTY) {
    printStaticResults(results, sources, query);
    return;
  }

  // TTY: header then interactive browser
  console.log();
  divider(`${results.length} results for "${query}"`);
  info(`Searched ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}: ${dim(sourceList)}`);
  if (sources.failed > 0) {
    warn(`${sources.failed} ${sources.failed === 1 ? 'source' : 'sources'} unreachable`);
  }
  console.log();

  const action = await interactiveBrowser(results, sources, query);

  if (action.type === 'install') {
    const r = action.result;
    success(`Selected ${bold(r.name)} ${dim(`(${r.source})`)}`);
    console.log();
    await installSkill(r);
  } else if (action.type === 'open') {
    const r = action.result;
    info(`Opening ${bold(r.name)} in browser...`);
    openUrl(r.url);
    console.log();
  } else {
    // quit
    console.log();
  }

  // Source legend
  console.log(`  ${dim('Sources:')} ${magenta('anthropic')} ${dim('official')}  ${cyan('skills.sh')} ${dim('Vercel')}  ${green('awesome')} ${dim('curated')}  ${dim('github community')}`);
  console.log();
}
