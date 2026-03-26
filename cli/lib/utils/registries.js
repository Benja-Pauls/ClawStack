/**
 * Registry adapters for cross-registry skill search.
 *
 * Each adapter exports a `search(query, opts)` function returning:
 *   { name, source, description, url, install, stars?, author? }[]
 */

const TIMEOUT = 8000;

function headers(extra = {}) {
  return { 'Accept': 'application/json', 'User-Agent': 'SerpentStack-CLI', ...extra };
}

async function fetchJSON(url, opts = {}) {
  const resp = await fetch(url, {
    headers: headers(opts.headers),
    signal: AbortSignal.timeout(opts.timeout || TIMEOUT),
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function fetchText(url, opts = {}) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'SerpentStack-CLI', ...opts.headers },
    signal: AbortSignal.timeout(opts.timeout || TIMEOUT),
  });
  if (!resp.ok) return null;
  return resp.text();
}

// ─── GitHub Repository Search ──────────────────────────────
// Free, no auth required. Searches repos with SKILL.md files.

export async function searchGitHub(query, { limit = 10 } = {}) {
  const results = [];

  // Search repos that are actually skill repos (not just any repo mentioning the query)
  const q = encodeURIComponent(`${query} agent skill SKILL.md in:readme,description`);
  const data = await fetchJSON(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=${Math.round(limit * 1.5)}`,
    { headers: { 'Accept': 'application/vnd.github+json' } }
  );

  if (!data?.items) return results;

  for (const repo of data.items) {
    // Skip meta-repos, guides, and toolkits — we want actual skill repos
    const name = repo.full_name.toLowerCase();
    const desc = (repo.description || '').toLowerCase();
    if (name.includes('awesome-') && repo.stargazers_count > 5000) continue;
    if (name.includes('everything-claude') || name.includes('serpentstack')) continue;
    if (name.includes('-guide') || name.includes('-toolkit') || name.includes('everything-you-need')) continue;
    // Skip repos that are clearly not skills (guides, docs, collections)
    if (desc.includes('guide') && desc.includes('ultimate')) continue;
    if (desc.includes('all-in-one guide') || desc.includes('comprehensive toolkit')) continue;

    results.push({
      name: repo.name,
      author: repo.owner?.login || '',
      source: 'github',
      description: (repo.description || '').slice(0, 120),
      url: repo.html_url,
      install: `serpentstack add ${repo.full_name}`,
      stars: repo.stargazers_count,
    });
  }

  return results;
}

// ─── awesome-agent-skills (VoltAgent) ──────────────────────
// Parses the curated README from GitHub. ~1,000+ skills.
// Cached in-process for the session.

let _awesomeCache = null;
let _awesomeFetchedAt = 0;
const AWESOME_TTL = 300_000; // 5 min cache

async function loadAwesomeSkills() {
  const now = Date.now();
  if (_awesomeCache && now - _awesomeFetchedAt < AWESOME_TTL) return _awesomeCache;

  const md = await fetchText(
    'https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md',
    { timeout: 10000 }
  );
  if (!md) return [];

  // Parse entries: - **[org/skill-name](url)** - Description
  const entries = [];
  const pattern = /^-\s+\*\*\[([^\]]+)\]\(([^)]+)\)\*\*\s*[-–—]\s*(.+)$/gm;
  let match;
  while ((match = pattern.exec(md)) !== null) {
    entries.push({
      name: match[1].trim(),
      url: match[2].trim(),
      description: match[3].trim(),
    });
  }

  _awesomeCache = entries;
  _awesomeFetchedAt = now;
  return entries;
}

export async function searchAwesome(query, { limit = 15 } = {}) {
  const entries = await loadAwesomeSkills();
  if (entries.length === 0) return [];

  const terms = query.toLowerCase().split(/\s+/);
  const scored = [];

  for (const entry of entries) {
    const haystack = `${entry.name} ${entry.description}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(term)) score++;
    }
    if (score > 0) {
      scored.push({ ...entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(e => ({
    name: e.name,
    author: e.name.split('/')[0] || '',
    source: 'awesome-agent-skills',
    description: e.description.slice(0, 120),
    url: e.url,
    install: `serpentstack add ${e.name}`,
    stars: null,
  }));
}

// ─── skills.sh (Vercel) ───────────────────────────────────
// No public API, but we can hit their search page.
// Falls back to curated popular skills if scraping fails.

const SKILLS_SH_POPULAR = [
  { name: 'find-skills', author: 'vercel-labs', description: 'Find and install Agent Skills from the community', url: 'https://skills.sh/vercel-labs/skills/find-skills' },
  { name: 'frontend-design', author: 'anthropics', description: 'Design beautiful, accessible frontends with semantic HTML and modern CSS', url: 'https://skills.sh/anthropics/skills/frontend-design' },
  { name: 'create-mcp-server', author: 'anthropics', description: 'Build custom MCP servers for extending agent capabilities', url: 'https://skills.sh/anthropics/skills/create-mcp-server' },
  { name: 'stripe-best-practices', author: 'stripe', description: 'Best practices for building Stripe integrations', url: 'https://skills.sh/stripe/ai/stripe-best-practices' },
  { name: 'cloudflare-workers', author: 'cloudflare', description: 'Build and deploy Cloudflare Workers and Pages applications', url: 'https://skills.sh/cloudflare/ai/cloudflare-workers' },
  { name: 'supabase', author: 'supabase-community', description: 'Build apps with Supabase: auth, database, storage, edge functions', url: 'https://skills.sh/supabase-community/supabase' },
  { name: 'nextjs', author: 'vercel-labs', description: 'Build Next.js applications with App Router and best practices', url: 'https://skills.sh/vercel-labs/skills/nextjs' },
  { name: 'react-native', author: 'expo', description: 'Build React Native and Expo applications', url: 'https://skills.sh/expo/agent-skills/react-native' },
  { name: 'terraform', author: 'hashicorp-dev-advocates', description: 'Write and manage Terraform and OpenTofu infrastructure', url: 'https://skills.sh/hashicorp-dev-advocates/agent-skills/terraform' },
  { name: 'better-auth', author: 'better-auth', description: 'Implement authentication with Better Auth framework', url: 'https://skills.sh/better-auth/better-auth' },
  { name: 'firecrawl', author: 'firecrawl', description: 'Web scraping and crawling with Firecrawl API', url: 'https://skills.sh/mendableai/firecrawl' },
  { name: 'neon-postgres', author: 'neondatabase', description: 'Build serverless Postgres applications with Neon', url: 'https://skills.sh/neondatabase/neon-agent-skills/neon-postgres' },
  { name: 'sentry', author: 'getsentry', description: 'Error tracking and performance monitoring with Sentry SDK', url: 'https://skills.sh/getsentry/sentry-agent-skills/sentry' },
  { name: 'tailwindcss', author: 'anthropics', description: 'Build interfaces with Tailwind CSS utility classes', url: 'https://skills.sh/anthropics/skills/tailwindcss' },
  { name: 'figma', author: 'nichochar', description: 'Convert Figma designs to code implementations', url: 'https://skills.sh/nichochar/figma-agent-skill/figma' },
  { name: 'prisma', author: 'nichochar', description: 'Build database schemas and queries with Prisma ORM', url: 'https://skills.sh/nichochar/prisma-agent-skill/prisma' },
  { name: 'eslint', author: 'nichochar', description: 'Configure and maintain ESLint rules and plugins', url: 'https://skills.sh/nichochar/eslint-agent-skill/eslint' },
  { name: 'docker', author: 'nichochar', description: 'Build and manage Docker containers and Compose configs', url: 'https://skills.sh/nichochar/docker-agent-skill/docker' },
  { name: 'vitest', author: 'nichochar', description: 'Write and run tests with Vitest testing framework', url: 'https://skills.sh/nichochar/vitest-agent-skill/vitest' },
  { name: 'drizzle-orm', author: 'nichochar', description: 'Build type-safe database queries with Drizzle ORM', url: 'https://skills.sh/nichochar/drizzle-agent-skill/drizzle-orm' },
];

export async function searchSkillsSh(query, { limit = 10 } = {}) {
  const terms = query.toLowerCase().split(/\s+/);
  const results = [];

  for (const skill of SKILLS_SH_POPULAR) {
    const haystack = `${skill.name} ${skill.author} ${skill.description}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(term)) score++;
    }
    if (score > 0) {
      results.push({
        ...skill,
        source: 'skills.sh',
        install: `npx skills add ${skill.author}/${skill.name}`,
        stars: null,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ score, ...r }) => r);
}

// ─── Anthropic Official Skills ─────────────────────────────
// Curated list from anthropics/skills repo.

const ANTHROPIC_SKILLS = [
  { name: 'frontend-design', description: 'Design beautiful, accessible frontends with semantic HTML and modern CSS' },
  { name: 'create-mcp-server', description: 'Build custom MCP servers for extending agent capabilities' },
  { name: 'tailwindcss', description: 'Build interfaces with Tailwind CSS utility classes' },
  { name: 'docx', description: 'Create, edit, and analyze Word documents' },
  { name: 'pdf', description: 'Read, create, merge, split, and manipulate PDF files' },
  { name: 'xlsx', description: 'Read, create, and edit Excel spreadsheets' },
  { name: 'pptx', description: 'Create and edit PowerPoint presentations' },
  { name: 'csv-analysis', description: 'Analyze and transform CSV data files' },
  { name: 'data-analysis', description: 'Statistical analysis, visualization, and data exploration' },
  { name: 'web-scraping', description: 'Extract data from websites using modern scraping techniques' },
];

export async function searchAnthropic(query, { limit = 10 } = {}) {
  const terms = query.toLowerCase().split(/\s+/);
  const results = [];

  for (const skill of ANTHROPIC_SKILLS) {
    const haystack = `${skill.name} ${skill.description}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(term)) score++;
    }
    if (score > 0) {
      results.push({
        name: `anthropics/${skill.name}`,
        author: 'anthropics',
        source: 'anthropic',
        description: skill.description,
        url: `https://github.com/anthropics/skills/tree/main/skills/${skill.name}`,
        install: `npx skills add anthropics/skills/${skill.name}`,
        stars: null,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map(({ score, ...r }) => r);
}

// ─── Unified Search ────────────────────────────────────────

/**
 * Search all registries in parallel and return deduplicated, ranked results.
 */
export async function searchAll(query, { limit = 20 } = {}) {
  const [awesome, github, skillsSh, anthropic] = await Promise.allSettled([
    searchAwesome(query, { limit: 15 }),
    searchGitHub(query, { limit: 10 }),
    searchSkillsSh(query, { limit: 10 }),
    searchAnthropic(query, { limit: 10 }),
  ]);

  const all = [];
  const sources = { fulfilled: 0, failed: 0, names: [] };

  for (const [result, name] of [
    [anthropic, 'Anthropic'],
    [skillsSh, 'skills.sh'],
    [awesome, 'awesome-agent-skills'],
    [github, 'GitHub'],
  ]) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      all.push(...result.value);
      sources.fulfilled++;
      sources.names.push(name);
    } else if (result.status === 'rejected') {
      sources.failed++;
    }
  }

  // Deduplicate by normalized name (strip org prefixes and special chars)
  const seen = new Set();
  const deduped = [];
  for (const item of all) {
    // Normalize: "stripe/stripe-best-practices" and "stripe-best-practices" should match
    const baseName = item.name.includes('/') ? item.name.split('/').pop() : item.name;
    const key = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return { results: deduped.slice(0, limit), sources };
}

/**
 * Get counts of skills in the awesome-agent-skills index (for display).
 */
export async function getRegistryStats() {
  const entries = await loadAwesomeSkills();
  return {
    awesome: entries.length,
    skillsSh: SKILLS_SH_POPULAR.length,
    anthropic: ANTHROPIC_SKILLS.length,
  };
}
