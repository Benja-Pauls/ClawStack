import { searchAll, getRegistryStats } from '../utils/registries.js';
import {
  info, success, warn, error,
  bold, dim, green, cyan, yellow, magenta,
  divider, printHeader, spinner, printSnakeList, printBox,
} from '../utils/ui.js';

// ─── Source badges ──────────────────────────────────────────

const SOURCE_BADGE = {
  'anthropic':            `${magenta('anthropic')}`,
  'skills.sh':            `${cyan('skills.sh')}`,
  'awesome-agent-skills': `${green('awesome')}`,
  'github':               `${dim('github')}`,
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

// ─── Result formatting ──────────────────────────────────────

function formatResult(result, index) {
  const num = dim(`${String(index + 1).padStart(2)}.`);
  const badge = sourceBadge(result.source);
  const stars = starsLabel(result.stars);
  const name = bold(result.name);
  const desc = result.description ? `\n      ${dim(result.description)}` : '';
  const install = `\n      ${dim('$')} ${dim(result.install)}`;

  return `${num} ${name}  ${badge}${stars}${desc}${install}`;
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

  // Header
  console.log();
  divider(`${results.length} results for "${query}"`);
  info(`Searched ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}: ${dim(sourceList)}`);
  if (sources.failed > 0) {
    warn(`${sources.failed} ${sources.failed === 1 ? 'source' : 'sources'} unreachable`);
  }
  console.log();

  // Results
  for (let i = 0; i < results.length; i++) {
    console.log(formatResult(results[i], i));
    if (i < results.length - 1) console.log();
  }

  console.log();

  // Footer
  const browseLines = [
    `${dim('$')} ${bold(`serpentstack search "${query} <more terms>"`)}   ${dim('refine results')}`,
    `${dim('$')} ${bold('serpentstack add <name>')}                       ${dim('install a skill')}`,
  ];
  printBox('Next steps', browseLines);
  console.log();

  // Source legend
  console.log(`  ${dim('Sources:')} ${magenta('anthropic')} ${dim('official')}  ${cyan('skills.sh')} ${dim('Vercel')}  ${green('awesome')} ${dim('curated')}  ${dim('github community')}`);
  console.log();
}
