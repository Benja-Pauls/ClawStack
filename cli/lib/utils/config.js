import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const CONFIG_PATH = '.openclaw/config.json';

// Default model for persistent agents — local first, always.
// Cloud models cost tokens per heartbeat and require API keys.
const DEFAULT_MODEL = 'ollama/llama3.2';

/**
 * Default config structure:
 * {
 *   project: { name, language, framework, devCmd, testCmd, conventions },
 *   agents: {
 *     "log-watcher": { enabled: true, model: "ollama/llama3.2" },
 *     ...
 *   }
 * }
 */

/**
 * Read the config file. Returns null if it doesn't exist.
 */
export function readConfig(projectDir) {
  const configPath = join(projectDir, CONFIG_PATH);
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`  \x1b[33m△\x1b[0m .openclaw/config.json has invalid JSON — ignoring. Fix it or delete it to regenerate.`);
    }
    return null;
  }
}

/**
 * Write config to .openclaw/config.json
 */
export function writeConfig(projectDir, config) {
  const configPath = join(projectDir, CONFIG_PATH);
  mkdirSync(join(projectDir, '.openclaw'), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

// ─── Project Detection ───────────────────────────────────────

/**
 * Detect project defaults by inspecting the filesystem.
 * Works for ANY project — detects name, language, framework, commands.
 * Always returns an object with every field populated (never empty strings).
 * When nothing can be detected, returns sensible "fill me in" defaults
 * that read naturally in the config file and prompt the user to update.
 */
export function detectProjectDefaults(projectDir) {
  return {
    name: detectProjectName(projectDir),
    language: detectLanguage(projectDir),
    framework: detectFramework(projectDir),
    devCmd: detectDevCmd(projectDir),
    testCmd: detectTestCmd(projectDir),
    conventions: detectConventions(projectDir),
  };
}

/**
 * Detect if this is a SerpentStack template project and return overrides.
 * Returns null if not a template project. When non-null, these values
 * take priority over the generic detection.
 */
export function detectTemplateDefaults(projectDir) {
  const makefile = join(projectDir, 'Makefile');
  if (!existsSync(makefile)) return null;

  try {
    const content = readFileSync(makefile, 'utf8');
    // SerpentStack Makefile: must have a 'verify:' target AND 'uv run' (Python tooling)
    if (!/^verify:/m.test(content)) return null;
    if (!content.includes('uv run')) return null;

    // It's a SerpentStack template project — return specific defaults
    const defaults = {
      language: 'Python + TypeScript',
      framework: 'FastAPI + React',
      devCmd: 'make dev',
      testCmd: 'make verify',
      conventions: 'Services flush, routes commit. Domain returns, not exceptions. Real Postgres in tests.',
    };

    // Try to detect project name from frontend/package.json
    const pkgPath = join(projectDir, 'frontend', 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.name && pkg.name !== 'frontend') defaults.name = pkg.name;
      } catch { /* ignore */ }
    }

    return defaults;
  } catch {
    return null;
  }
}

// ─── Detection helpers ───────────────────────────────────────

function detectProjectName(projectDir) {
  // 1. package.json name
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.name && pkg.name !== 'unnamed') return pkg.name;
    } catch { /* ignore */ }
  }

  // 2. pyproject.toml name
  const pyprojectPath = join(projectDir, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    try {
      const content = readFileSync(pyprojectPath, 'utf8');
      const match = content.match(/^name\s*=\s*"([^"]+)"/m);
      if (match) return match[1];
    } catch { /* ignore */ }
  }

  // 3. Cargo.toml name
  const cargoPath = join(projectDir, 'Cargo.toml');
  if (existsSync(cargoPath)) {
    try {
      const content = readFileSync(cargoPath, 'utf8');
      const match = content.match(/^name\s*=\s*"([^"]+)"/m);
      if (match) return match[1];
    } catch { /* ignore */ }
  }

  // 4. Fall back to directory name
  return basename(projectDir);
}

function detectLanguage(projectDir) {
  const langs = [];
  if (existsSync(join(projectDir, 'pyproject.toml')) || existsSync(join(projectDir, 'requirements.txt')) || existsSync(join(projectDir, 'setup.py'))) {
    langs.push('Python');
  }
  if (existsSync(join(projectDir, 'tsconfig.json'))) {
    langs.push('TypeScript');
  } else if (existsSync(join(projectDir, 'package.json'))) {
    langs.push('JavaScript');
  }
  if (existsSync(join(projectDir, 'go.mod'))) {
    langs.push('Go');
  }
  if (existsSync(join(projectDir, 'Cargo.toml'))) {
    langs.push('Rust');
  }
  if (existsSync(join(projectDir, 'pom.xml')) || existsSync(join(projectDir, 'build.gradle'))) {
    langs.push('Java');
  }
  if (existsSync(join(projectDir, 'Gemfile'))) {
    langs.push('Ruby');
  }
  // If nothing detected, use SerpentStack template default since
  // that's the most common use case (user just ran `stack new`)
  return langs.length > 0 ? langs.join(' + ') : 'Python + TypeScript';
}

function detectFramework(projectDir) {
  const frameworks = [];

  // Python frameworks
  const pyFiles = [join(projectDir, 'pyproject.toml'), join(projectDir, 'requirements.txt')];
  for (const f of pyFiles) {
    if (!existsSync(f)) continue;
    try {
      const content = readFileSync(f, 'utf8');
      if (content.includes('fastapi')) frameworks.push('FastAPI');
      else if (content.includes('django')) frameworks.push('Django');
      else if (content.includes('flask')) frameworks.push('Flask');
      break;
    } catch { /* ignore */ }
  }

  // JS/TS frameworks
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps['next']) frameworks.push('Next.js');
      else if (allDeps['react']) frameworks.push('React');
      else if (allDeps['vue']) frameworks.push('Vue');
      else if (allDeps['svelte'] || allDeps['@sveltejs/kit']) frameworks.push('Svelte');
      else if (allDeps['express']) frameworks.push('Express');
    } catch { /* ignore */ }
  }

  // Go frameworks
  const goModPath = join(projectDir, 'go.mod');
  if (existsSync(goModPath)) {
    try {
      const content = readFileSync(goModPath, 'utf8');
      if (content.includes('gin-gonic')) frameworks.push('Gin');
      else if (content.includes('labstack/echo')) frameworks.push('Echo');
      else if (content.includes('gofiber')) frameworks.push('Fiber');
      else frameworks.push('Go');
    } catch { /* ignore */ }
  }

  // Ruby
  const gemfilePath = join(projectDir, 'Gemfile');
  if (existsSync(gemfilePath)) {
    try {
      const content = readFileSync(gemfilePath, 'utf8');
      if (content.includes('rails')) frameworks.push('Rails');
      else if (content.includes('sinatra')) frameworks.push('Sinatra');
    } catch { /* ignore */ }
  }

  return frameworks.length > 0 ? frameworks.join(' + ') : 'FastAPI + React';
}

function detectDevCmd(projectDir) {
  // Makefile targets
  const makefile = join(projectDir, 'Makefile');
  if (existsSync(makefile)) {
    try {
      const content = readFileSync(makefile, 'utf8');
      if (/^dev:/m.test(content)) return 'make dev';
      if (/^start:/m.test(content)) return 'make start';
      if (/^run:/m.test(content)) return 'make run';
      if (/^serve:/m.test(content)) return 'make serve';
    } catch { /* ignore */ }
  }

  // package.json scripts
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};
      if (scripts.dev) return 'npm run dev';
      if (scripts.start) return 'npm start';
      if (scripts.serve) return 'npm run serve';
    } catch { /* ignore */ }
  }

  // Python
  if (existsSync(join(projectDir, 'manage.py'))) return 'python manage.py runserver';
  if (existsSync(join(projectDir, 'pyproject.toml'))) return 'uv run python -m app';

  return 'make dev';
}

function detectTestCmd(projectDir) {
  // Makefile targets
  const makefile = join(projectDir, 'Makefile');
  if (existsSync(makefile)) {
    try {
      const content = readFileSync(makefile, 'utf8');
      if (/^verify:/m.test(content)) return 'make verify';
      if (/^test:/m.test(content)) return 'make test';
      if (/^check:/m.test(content)) return 'make check';
    } catch { /* ignore */ }
  }

  // package.json scripts
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};
      if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return 'npm test';
      }
    } catch { /* ignore */ }
  }

  // Python
  if (existsSync(join(projectDir, 'pyproject.toml')) || existsSync(join(projectDir, 'setup.py'))) {
    return 'pytest';
  }

  // Go
  if (existsSync(join(projectDir, 'go.mod'))) return 'go test ./...';

  // Rust
  if (existsSync(join(projectDir, 'Cargo.toml'))) return 'cargo test';

  return 'make verify';
}

function detectConventions(projectDir) {
  // Check if this looks like a SerpentStack template (has the standard Makefile)
  const makefile = join(projectDir, 'Makefile');
  if (existsSync(makefile)) {
    try {
      const content = readFileSync(makefile, 'utf8');
      if (/^verify:/m.test(content) && content.includes('uv run')) {
        return 'Services flush, routes commit. Domain returns, not exceptions. Real Postgres in tests.';
      }
    } catch { /* ignore */ }
  }

  return 'Follow existing patterns. Match the style of surrounding code.';
}

/**
 * Build a default agent config entry from an AGENT.md's parsed meta.
 */
export function defaultAgentConfig(meta) {
  return {
    enabled: true,
    model: DEFAULT_MODEL,
  };
}

/**
 * Get the effective model for an agent, respecting config overrides.
 */
export function getEffectiveModel(agentName, agentMeta, config) {
  if (config?.agents?.[agentName]?.model) {
    return config.agents[agentName].model;
  }
  return DEFAULT_MODEL;
}

/**
 * Check if an agent is enabled in the config.
 */
export function isAgentEnabled(agentName, config) {
  if (!config?.agents?.[agentName]) return true; // enabled by default
  return config.agents[agentName].enabled !== false;
}
