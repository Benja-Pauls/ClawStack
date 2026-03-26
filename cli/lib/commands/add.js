import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  info, success, warn, error,
  bold, dim, green, cyan,
  printHeader, spinner,
} from '../utils/ui.js';
import { searchAwesome, searchSkillsSh, searchAnthropic } from '../utils/registries.js';

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

async function fetchJSON(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'SerpentStack-CLI', 'Accept': 'application/vnd.github+json' },
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch { return null; }
}

/**
 * Parse a GitHub URL into { owner, repo, subpath }.
 */
function parseGitHubUrl(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/(?:tree|blob)\/[^/]+\/(.+))?/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], subpath: m[3] || '' };
}

/**
 * Try fetching a SKILL.md from a GitHub repo.
 * Returns { content, url } or null.
 */
async function fetchSkillMd(owner, repo, subpath, skillHint) {
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

  if (skillHint && skillHint !== subpath) {
    candidates.push(`${base}/main/skills/${skillHint}/SKILL.md`);
    candidates.push(`${base}/main/${skillHint}/SKILL.md`);
  }

  for (const url of candidates) {
    const content = await tryFetchRaw(url);
    if (content) return { content, url };
  }

  // Strategy 2: GitHub code search API (requires auth, may 401)
  try {
    const data = await fetchJSON(
      `https://api.github.com/search/code?q=filename:SKILL.md+repo:${owner}/${repo}&per_page=5`
    );
    if (data?.items?.length > 0) {
      const sorted = [...data.items].sort((a, b) => {
        const aMatch = (subpath && a.path.includes(subpath)) || (skillHint && a.path.includes(skillHint)) ? 0 : 1;
        const bMatch = (subpath && b.path.includes(subpath)) || (skillHint && b.path.includes(skillHint)) ? 0 : 1;
        return aMatch - bMatch;
      });
      for (const item of sorted) {
        const rawUrl = `${base}/main/${item.path}`;
        const content = await tryFetchRaw(rawUrl);
        if (content) return { content, url: rawUrl };
      }
    }
  } catch { /* code search requires auth */ }

  // Strategy 3: recursive git tree traversal (free, thorough)
  const tree = await fetchJSON(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`
  );
  if (tree?.tree) {
    const skillFiles = tree.tree
      .filter(f => f.path.endsWith('/SKILL.md') || f.path === 'SKILL.md')
      .map(f => f.path);

    if (skillFiles.length > 0) {
      const sorted = [...skillFiles].sort((a, b) => {
        const aMatch = (subpath && a.includes(subpath)) || (skillHint && a.includes(skillHint)) ? 0 : 1;
        const bMatch = (subpath && b.includes(subpath)) || (skillHint && b.includes(skillHint)) ? 0 : 1;
        return aMatch - bMatch;
      });

      const rawUrl = `${base}/main/${sorted[0]}`;
      const content = await tryFetchRaw(rawUrl);
      if (content) return { content, url: rawUrl };
    }
  }

  return null;
}

/**
 * Find an exact match in skills.sh for the npx fallback message.
 * Returns the install command or null.
 */
async function findSkillsShFallback(input) {
  const results = await searchSkillsSh(input, { limit: 3 });
  const inputName = input.includes('/') ? input.split('/').pop() : input;

  for (const r of results) {
    const rName = r.name.includes('/') ? r.name.split('/').pop() : r.name;
    if (rName.toLowerCase() === inputName.toLowerCase()) {
      return r.install; // e.g., "npx skills add nichochar/docker"
    }
  }
  return null;
}

/**
 * Resolve a skill name or partial path through our registries.
 * Returns an array of { owner, repo, subpath, skillName } candidates to try.
 *
 * Handles:
 *   - "clerk" → finds clerk/skills via skills.sh
 *   - "better-auth/best-practices" → finds github.com/better-auth/skills via awesome
 *   - "stripe-best-practices" → finds stripe/ai via skills.sh or awesome
 */
async function resolveViaRegistries(input) {
  const normalized = input.toLowerCase().replace(/[^a-z0-9/-]/g, '');
  const inputName = input.includes('/') ? input.split('/').pop() : input;

  // For inputs with slashes like "better-auth/best-practices",
  // search for both the full string and individual parts
  const searchTerms = [input];
  if (input.includes('/')) {
    searchTerms.push(inputName);
    searchTerms.push(input.split('/')[0]);
  }

  // Run all searches in parallel
  const allSearches = searchTerms.flatMap(term => [
    searchAwesome(term, { limit: 8 }),
    searchSkillsSh(term, { limit: 5 }),
    searchAnthropic(term, { limit: 5 }),
  ]);

  const settled = await Promise.allSettled(allSearches);
  const allMatches = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') allMatches.push(...result.value);
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = [];
  for (const match of allMatches) {
    const key = match.url || match.name;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(match);
  }

  const candidates = [];

  for (const match of unique) {
    const matchName = match.name.includes('/') ? match.name.split('/').pop() : match.name;

    // Check if this is a relevant match for our input
    const isExact = matchName.toLowerCase() === inputName.toLowerCase() ||
                    match.name.toLowerCase() === normalized;

    if (!isExact) continue;

    // ─── GitHub URL: most reliable ──────────────────────────
    if (match.url?.includes('github.com')) {
      const parsed = parseGitHubUrl(match.url);
      if (parsed) {
        candidates.push({ ...parsed, skillName: matchName, source: match.source });
      }
      continue;
    }

    // ─── Anthropic skills: known structure ──────────────────
    if (match.source === 'anthropic') {
      candidates.push({
        owner: 'anthropics',
        repo: 'skills',
        subpath: `skills/${matchName}`,
        skillName: matchName,
        source: 'anthropic',
      });
      continue;
    }

    // ─── skills.sh: try multiple GitHub repo patterns ───────
    if (match.url?.includes('skills.sh')) {
      const parts = match.url.replace(/^https?:\/\/skills\.sh\//, '').split('/');
      if (parts.length >= 1) {
        const owner = parts[0];

        // Generate candidates in order of likelihood
        candidates.push({ owner, repo: 'skills', subpath: '', skillName: matchName, source: match.source });
        if (parts.length >= 2) {
          const urlRepo = parts.slice(1, parts.length >= 3 ? -1 : undefined).join('/');
          if (urlRepo !== 'skills') {
            candidates.push({ owner, repo: urlRepo, subpath: '', skillName: matchName, source: match.source });
          }
        }
        candidates.push({ owner, repo: 'agent-skills', subpath: '', skillName: matchName, source: match.source });
        candidates.push({ owner, repo: `${matchName}-skill`, subpath: '', skillName: matchName, source: match.source });
        candidates.push({ owner, repo: `${matchName}-agent-skill`, subpath: '', skillName: matchName, source: match.source });
        candidates.push({ owner, repo: matchName, subpath: '', skillName: matchName, source: match.source });
      }
    }
  }

  return candidates;
}

/**
 * Last resort: search GitHub for repos matching the input.
 */
async function resolveViaGitHubSearch(input) {
  const q = encodeURIComponent(`${input} SKILL.md in:name,description`);
  const data = await fetchJSON(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=5`
  );

  if (!data?.items?.length) return [];

  const candidates = [];
  const inputLower = input.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const repo of data.items) {
    const nameLower = repo.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nameLower.includes(inputLower) && !inputLower.includes(nameLower)) continue;

    candidates.push({
      owner: repo.owner.login,
      repo: repo.name,
      subpath: '',
      skillName: repo.name,
    });
  }

  return candidates;
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
    console.log(`  ${dim('       serpentstack add')} ${dim('<skill-name>')}`);
    console.log();
    console.log(`  ${dim('Examples:')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack add stripe/stripe-best-practices')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack add clerk')}`);
    console.log(`    ${dim('$')} ${bold('serpentstack add docker')}`);
    console.log();
    return;
  }

  const clean = source.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
  const parts = clean.split('/');

  const spin = spinner(`Fetching ${bold(clean)}...`);

  let result = null;
  let skillName = parts[parts.length - 1].replace(/[^a-z0-9_-]/gi, '-');

  // ─── Step 1: Direct GitHub fetch (if we have owner/repo) ──
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1];
    const subpath = parts.slice(2).join('/');
    result = await fetchSkillMd(owner, repo, subpath, skillName);
  }

  // ─── Step 2: Registry lookup ──────────────────────────────
  if (!result) {
    spin.update(`Searching registries for ${bold(clean)}...`);
    const candidates = await resolveViaRegistries(clean);

    for (const candidate of candidates) {
      spin.update(`Trying ${bold(`${candidate.owner}/${candidate.repo}`)}...`);
      result = await fetchSkillMd(candidate.owner, candidate.repo, candidate.subpath, candidate.skillName);
      if (result) {
        skillName = candidate.skillName;
        break;
      }
    }
  }

  // ─── Step 3: GitHub search fallback ───────────────────────
  if (!result) {
    spin.update(`Searching GitHub for ${bold(clean)}...`);
    const candidates = await resolveViaGitHubSearch(clean);

    for (const candidate of candidates) {
      spin.update(`Trying ${bold(`${candidate.owner}/${candidate.repo}`)}...`);
      result = await fetchSkillMd(candidate.owner, candidate.repo, candidate.subpath, candidate.skillName);
      if (result) {
        skillName = candidate.skillName;
        break;
      }
    }
  }

  // ─── Handle result ────────────────────────────────────────

  if (!result) {
    spin.stop();
    error(`Could not find SKILL.md for ${bold(clean)}.`);
    console.log();

    // Check if this skill exists on skills.sh (GitHub-unfetchable)
    const npxCmd = await findSkillsShFallback(clean);
    if (npxCmd) {
      console.log(`  ${dim('This skill is hosted on')} ${cyan('skills.sh')} ${dim('and not available as a GitHub repo.')}`);
      console.log(`  ${dim('Install it with the skills.sh CLI instead:')}`);
      console.log();
      console.log(`    ${dim('$')} ${bold(npxCmd)}`);
      console.log();
      return;
    }

    console.log(`  ${dim('This could mean:')}`);
    console.log(`    ${dim('•')} The repo doesn't contain a SKILL.md file`);
    console.log(`    ${dim('•')} The skill name doesn't match any known registry entry`);
    console.log(`    ${dim('•')} The repo uses a non-standard directory structure`);
    console.log();
    console.log(`  ${dim('Try searching first:')}`);
    console.log(`    ${dim('$')} ${cyan(`serpentstack search "${clean}"`)}`);
    if (parts.length >= 2) {
      console.log();
      console.log(`  ${dim('Or browse the repo:')}`);
      console.log(`    ${cyan(`https://github.com/${parts.slice(0, 2).join('/')}`)}`);
    }
    console.log();
    return;
  }

  skillName = skillName.replace(/[^a-z0-9_-]/gi, '-');

  const skillDir = join(process.cwd(), '.skills', skillName);
  const skillPath = join(skillDir, 'SKILL.md');

  if (existsSync(skillPath) && !force) {
    spin.stop();
    warn(`${bold(`.skills/${skillName}/SKILL.md`)} already exists.`);
    info(`Use ${bold('--force')} to overwrite.`);
    console.log();
    return;
  }

  mkdirSync(skillDir, { recursive: true });
  writeFileSync(skillPath, result.content, 'utf8');

  spin.stop();
  success(`Installed ${bold(skillName)} → ${green(`.skills/${skillName}/SKILL.md`)}`);
  console.log(`    ${dim(`Source: ${result.url}`)}`);
  console.log();

  const lines = result.content.split('\n').length;
  const bytes = Buffer.byteLength(result.content, 'utf8');
  const size = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
  info(`${lines} lines, ${size}`);
  console.log();

  console.log(`  ${dim('Your agents can now read this skill. Try:')}`);
  console.log(`    ${dim('>')} ${bold(`Read .skills/${skillName}/SKILL.md and follow its instructions`)}`);
  console.log();
}
