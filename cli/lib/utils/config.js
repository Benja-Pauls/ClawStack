import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_PATH = '.openclaw/config.json';

/**
 * Default config structure:
 * {
 *   project: { name, language, framework, devCmd, testCmd, conventions },
 *   agents: {
 *     "log-watcher": { enabled: true, model: "anthropic/claude-haiku-4-20250414" },
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
      console.error(`  \x1b[33m\u25B3\x1b[0m .openclaw/config.json has invalid JSON — ignoring. Fix it or delete it to regenerate.`);
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

/**
 * Detect if this is a SerpentStack template project and return defaults.
 * Returns null if not a template project.
 */
export function detectTemplateDefaults(projectDir) {
  const makefile = join(projectDir, 'Makefile');
  if (!existsSync(makefile)) return null;

  try {
    const content = readFileSync(makefile, 'utf8');
    // SerpentStack Makefile: must have 'make verify' AND either 'uv run' or 'uvicorn'
    if (!content.includes('make verify')) return null;
    if (!content.includes('uv run') && !content.includes('uvicorn')) return null;

    // It's a SerpentStack template project — return smart defaults
    const defaults = {
      language: 'Python + TypeScript',
      framework: 'FastAPI + React',
      devCmd: 'make dev',
      testCmd: 'make verify',
      conventions: 'Services flush, routes commit. Domain returns, not exceptions. Real Postgres in tests.',
    };

    // Try to detect project name from scripts/init.py or package.json
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

/**
 * Build a default agent config entry from an AGENT.md's parsed meta.
 */
export function defaultAgentConfig(meta) {
  return {
    enabled: true,
    model: meta.model || 'anthropic/claude-haiku-4-20250414',
  };
}

/**
 * Get the effective model for an agent, respecting config overrides.
 */
export function getEffectiveModel(agentName, agentMeta, config) {
  if (config?.agents?.[agentName]?.model) {
    return config.agents[agentName].model;
  }
  return agentMeta.model || 'anthropic/claude-haiku-4-20250414';
}

/**
 * Check if an agent is enabled in the config.
 */
export function isAgentEnabled(agentName, config) {
  if (!config?.agents?.[agentName]) return true; // enabled by default
  return config.agents[agentName].enabled !== false;
}
