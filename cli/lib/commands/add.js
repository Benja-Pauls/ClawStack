import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  info, success, warn, error,
  bold, dim, green, cyan,
  printHeader, spinner,
} from '../utils/ui.js';

const TIMEOUT = 10000;

async function tryFetchRaw(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'SerpentStack-CLI' },
    });
    if (!resp.ok) return null;
    const content = await resp.text();
    if (content.length > 20 && !content.startsWith('<!DOCTYPE') && !content.startsWith('<html')) {
      return content;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Try fetching a SKILL.md from a GitHub repo.
 * Strategy: try direct path guesses first (fast), then fall back to
 * GitHub API search for SKILL.md files in the repo (slower but thorough).
 * Returns { content, url } or null.
 */
async function fetchSkillMd(repoPath) {
  const parts = repoPath.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '').split('/');
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1];
  const subpath = parts.slice(2).join('/');
  const base = `https://raw.githubusercontent.com/${owner}/${repo}`;

  // Strategy 1: direct path guesses (fast, no API calls)
  const candidates = [];

  if (subpath) {
    candidates.push(`${base}/main/${subpath}/SKILL.md`);
    candidates.push(`${base}/main/skills/${subpath}/SKILL.md`);
    candidates.push(`${base}/master/${subpath}/SKILL.md`);
  }

  candidates.push(`${base}/main/SKILL.md`);
  candidates.push(`${base}/master/SKILL.md`);

  const skillName = parts[parts.length - 1];
  candidates.push(`${base}/main/skills/${skillName}/SKILL.md`);

  for (const url of candidates) {
    const content = await tryFetchRaw(url);
    if (content) return { content, url };
  }

  // Strategy 2: use GitHub API to find SKILL.md files in the repo
  try {
    const apiUrl = `https://api.github.com/search/code?q=filename:SKILL.md+repo:${owner}/${repo}&per_page=5`;
    const resp = await fetch(apiUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'SerpentStack-CLI', 'Accept': 'application/vnd.github+json' },
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.items?.length > 0) {
        // If we have a subpath hint, prefer matches containing it
        const sorted = [...data.items].sort((a, b) => {
          const aMatch = subpath && a.path.includes(subpath) ? 0 : 1;
          const bMatch = subpath && b.path.includes(subpath) ? 0 : 1;
          return aMatch - bMatch;
        });
        for (const item of sorted) {
          const rawUrl = `${base}/main/${item.path}`;
          const content = await tryFetchRaw(rawUrl);
          if (content) return { content, url: rawUrl };
        }
      }
    }
  } catch { /* API search failed — we tried */ }

  // Strategy 3: recursively browse the repo tree via API (no auth needed for git trees)
  try {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    const resp = await fetch(treeUrl, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'SerpentStack-CLI', 'Accept': 'application/vnd.github+json' },
    });
    if (resp.ok) {
      const data = await resp.json();
      const skillFiles = (data.tree || [])
        .filter(f => f.path.endsWith('/SKILL.md') || f.path === 'SKILL.md')
        .map(f => f.path);

      if (skillFiles.length > 0) {
        // Prefer files matching the subpath or skill name
        const sorted = [...skillFiles].sort((a, b) => {
          const aMatch = (subpath && a.includes(subpath)) || a.includes(skillName) ? 0 : 1;
          const bMatch = (subpath && b.includes(subpath)) || b.includes(skillName) ? 0 : 1;
          return aMatch - bMatch;
        });

        const rawUrl = `${base}/main/${sorted[0]}`;
        const content = await tryFetchRaw(rawUrl);
        if (content) return { content, url: rawUrl };
      }
    }
  } catch { /* tree fetch failed */ }

  return null;
}

/**
 * Install a skill from a GitHub source into .skills/<name>/SKILL.md
 */
export async function add(source, { force = false } = {}) {
  printHeader();

  if (!source || source.trim().length === 0) {
    error('Missing skill source.');
    console.log();
    console.log(`  ${dim('Usage:')} ${bold('serpentstack add')} ${dim('<owner/repo>')}`);
    console.log(`  ${dim('       serpentstack add')} ${dim('<owner/repo/skill-name>')}`);
    console.log();
    console.log(`  ${dim('Examples:')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack add stripe/ai/stripe-best-practices')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack add hashicorp/agent-skills/terraform')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack add antonbabenko/terraform-skill')}`);
    console.log();
    return;
  }

  const clean = source.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
  const parts = clean.split('/');
  const skillName = parts[parts.length - 1].replace(/[^a-z0-9_-]/gi, '-');
  const skillDir = join(process.cwd(), '.skills', skillName);
  const skillPath = join(skillDir, 'SKILL.md');

  // Check for existing
  if (existsSync(skillPath) && !force) {
    warn(`${bold(`.skills/${skillName}/SKILL.md`)} already exists.`);
    info(`Use ${bold('--force')} to overwrite.`);
    console.log();
    return;
  }

  const spin = spinner(`Fetching ${bold(clean)}...`);

  const result = await fetchSkillMd(clean);

  if (!result) {
    spin.stop();
    error(`Could not find SKILL.md in ${bold(clean)}.`);
    console.log();
    console.log(`  ${dim('The repo may not contain a SKILL.md, or it may be in an unexpected location.')}`);
    console.log(`  ${dim('Try browsing the repo directly:')}`);
    console.log(`    ${cyan(`https://github.com/${parts.slice(0, 2).join('/')}`)}`);
    console.log();
    return;
  }

  mkdirSync(skillDir, { recursive: true });
  writeFileSync(skillPath, result.content, 'utf8');

  spin.stop();
  success(`Installed ${bold(skillName)} → ${green(`.skills/${skillName}/SKILL.md`)}`);
  console.log(`    ${dim(`Source: ${result.url}`)}`);
  console.log();

  // Show size info
  const lines = result.content.split('\n').length;
  const bytes = Buffer.byteLength(result.content, 'utf8');
  const size = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  info(`${lines} lines, ${size}`);
  console.log();

  console.log(`  ${dim('Your agents can now read this skill. Try:')}`);
  console.log(`    ${dim('>')} ${bold(`Read .skills/${skillName}/SKILL.md and follow its instructions`)}`);
  console.log();
}
