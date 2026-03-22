import { execFile } from 'node:child_process';

// ─── Fallback Recommendations ───────────────────────────────
// Used only when the Ollama library API is unreachable.
// When online, we fetch fresh models from ollama.com/api/tags.

const FALLBACK_RECOMMENDATIONS = [
  { name: 'gemma3:4b',       params: '4B',  size: '8.0 GB',  description: 'Small and fast — great for log watching' },
  { name: 'ministral-3:3b',  params: '3B',  size: '4.3 GB',  description: 'Lightweight, good for simple tasks' },
  { name: 'ministral-3:8b',  params: '8B',  size: '9.7 GB',  description: 'Balanced — good default for most agents' },
  { name: 'devstral-small-2:24b', params: '24B', size: '14.6 GB', description: 'Code-focused, strong for test runner agents' },
];

// Max model size to recommend (16 GB — fits on most dev machines)
const MAX_RECOMMEND_SIZE = 16 * 1024 ** 3;

/**
 * Detect all available models: local (Ollama) and cloud (via OpenClaw auth).
 * Also fetches recommended models from the Ollama library.
 *
 * Returns {
 *   local: [...],
 *   cloud: [...],
 *   hasApiKey: bool,
 *   ollamaRunning: bool,
 *   ollamaInstalled: bool,
 *   openclawInstalled: bool,
 *   recommended: [...],  // models user doesn't have yet
 * }
 */
export async function detectModels() {
  const [ollamaStatus, openclawInfo, libraryResult] = await Promise.all([
    detectOllamaStatus(),
    detectOpenClawAuth(),
    fetchOllamaLibrary(),
  ]);

  // Filter out models the user already has installed
  const installedNames = new Set(ollamaStatus.models.map(m => m.name.split(':')[0]));
  const recommended = libraryResult.models.filter(r => {
    const baseName = r.name.split(':')[0];
    return !installedNames.has(baseName);
  });

  return {
    local: ollamaStatus.models,
    cloud: openclawInfo.models,
    hasApiKey: openclawInfo.hasApiKey,
    ollamaRunning: ollamaStatus.running,
    ollamaInstalled: ollamaStatus.installed,
    openclawInstalled: openclawInfo.installed,
    recommended,
    recommendedLive: libraryResult.live,
  };
}

// ─── Ollama Library (live from ollama.com) ───────────────────

/**
 * Fetch available models from the Ollama library API.
 * Filters to models suitable for persistent agents (< MAX_RECOMMEND_SIZE).
 * Falls back to a hardcoded list if the API is unreachable.
 */
async function fetchOllamaLibrary() {
  try {
    const response = await fetchWithTimeout('https://ollama.com/api/tags', 5000);
    if (!response.ok) return { models: FALLBACK_RECOMMENDATIONS, live: false };

    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) return { models: FALLBACK_RECOMMENDATIONS, live: false };

    // Filter to models that fit on a dev machine
    const suitable = data.models
      .filter(m => m.size > 0 && m.size <= MAX_RECOMMEND_SIZE)
      .sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at))
      .map(m => {
        const name = m.name || '';
        const params = extractParams(name, m.size);
        return {
          name,
          params,
          size: formatBytes(m.size),
          description: describeModel(name),
        };
      });

    return suitable.length > 0
      ? { models: suitable, live: true }
      : { models: FALLBACK_RECOMMENDATIONS, live: false };
  } catch {
    return { models: FALLBACK_RECOMMENDATIONS, live: false };
  }
}

/**
 * Generate a short description for a model based on its name.
 */
function describeModel(name) {
  const n = name.toLowerCase();
  if (n.includes('devstral') || n.includes('codellama') || n.includes('deepseek-coder') || n.includes('coder'))
    return 'Code-focused';
  if (n.includes('gemma')) return 'Google, general purpose';
  if (n.includes('llama')) return 'Meta, general purpose';
  if (n.includes('mistral') || n.includes('ministral')) return 'Mistral AI';
  if (n.includes('qwen')) return 'Alibaba, multilingual';
  if (n.includes('nemotron')) return 'NVIDIA';
  if (n.includes('gpt-oss')) return 'Open-source GPT variant';
  return 'General purpose';
}

/**
 * Extract parameter count from model name tag or estimate from size.
 */
function extractParams(name, size) {
  // Check for explicit param count in the name (e.g., "gemma3:4b", "ministral-3:8b")
  const tagMatch = name.match(/:(\d+\.?\d*)([bBmM])/);
  if (tagMatch) return `${tagMatch[1]}${tagMatch[2].toUpperCase()}`;

  // Estimate from size
  return guessParamsFromSize(size);
}

// ─── Ollama Local Status ────────────────────────────────────

async function detectOllamaStatus() {
  const result = { installed: false, running: false, models: [] };

  try {
    await execAsync('which', ['ollama']);
    result.installed = true;
  } catch {
    return result;
  }

  try {
    const response = await fetchWithTimeout('http://localhost:11434/api/tags', 3000);
    if (!response.ok) return result;

    result.running = true;
    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) return result;

    result.models = data.models.map(m => {
      const name = (m.name || '').replace(':latest', '');
      if (!name) return null;

      const details = m.details || {};
      const params = formatParamCount(details.parameter_size) || guessParamsFromSize(m.size);
      const quant = details.quantization_level || '';
      const sizeStr = formatBytes(m.size);

      return {
        id: `ollama/${name}`,
        name,
        params,
        quant,
        size: sizeStr,
        tier: 'local',
      };
    }).filter(Boolean);
  } catch {
    // Ollama installed but not running
  }

  return result;
}

// ─── OpenClaw Auth & Cloud Models ───────────────────────────

async function detectOpenClawAuth() {
  const result = { models: [], hasApiKey: false, installed: false };

  try {
    await execAsync('which', ['openclaw']);
    result.installed = true;
  } catch {
    result.models = [
      { id: 'anthropic/claude-haiku-4-20250414', name: 'Haiku', provider: 'anthropic', tier: 'cloud' },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Sonnet', provider: 'anthropic', tier: 'cloud' },
    ];
    return result;
  }

  try {
    const status = await execAsync('openclaw', ['models', 'status']);
    if (status.includes('api_key') || status.includes('configured')) {
      result.hasApiKey = true;
    }

    const list = await execAsync('openclaw', ['models', 'list', '--json']);
    try {
      const models = JSON.parse(list);
      if (Array.isArray(models)) {
        result.models = models
          .filter(m => m.available && !m.local)
          .map(m => ({
            id: m.key || m.name,
            name: modelShortName(m.key || m.name),
            provider: (m.key || '').split('/')[0] || 'unknown',
            tier: 'cloud',
          }));
      }
    } catch {
      const text = await execAsync('openclaw', ['models', 'list']);
      const lines = text.trim().split('\n').filter(l => l.trim() && !l.startsWith('Model'));
      result.models = lines.map(l => {
        const id = l.trim().split(/\s+/)[0];
        if (!id || id.length < 3) return null;
        return { id, name: modelShortName(id), provider: id.split('/')[0], tier: 'cloud' };
      }).filter(Boolean);
    }
  } catch {
    result.models = [
      { id: 'anthropic/claude-haiku-4-20250414', name: 'Haiku', provider: 'anthropic', tier: 'cloud' },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Sonnet', provider: 'anthropic', tier: 'cloud' },
    ];
  }

  return result;
}

// ─── Formatting Helpers ─────────────────────────────────────

function formatParamCount(paramSize) {
  if (!paramSize) return '';
  const s = String(paramSize).trim();
  if (/^\d+\.?\d*[BbMm]$/i.test(s)) return s.toUpperCase();
  return s;
}

function guessParamsFromSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / (1024 ** 3);
  const billions = Math.round(gb * 2);
  if (billions > 0) return `~${billions}B`;
  return '';
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${Math.round(mb)} MB`;
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

/**
 * Short display name for a model ID.
 */
export function modelShortName(model) {
  if (!model) return 'unknown';
  if (model.startsWith('anthropic/')) {
    if (model.includes('haiku')) return 'Haiku';
    if (model.includes('sonnet')) return 'Sonnet';
    if (model.includes('opus')) return 'Opus';
    return model.slice('anthropic/'.length);
  }
  if (model.startsWith('ollama/')) return model.slice('ollama/'.length);
  if (model.includes('/')) return model.split('/').pop();
  return model;
}

function execAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}
