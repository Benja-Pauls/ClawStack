import { execFile } from 'node:child_process';

/**
 * Detect all available models: local (Ollama) and cloud (via OpenClaw auth).
 * Local models are preferred for persistent agents — they're free and fast.
 * Cloud models require API keys and cost money per token.
 *
 * Returns { local: [...], cloud: [...], hasApiKey: bool }
 */
export async function detectModels() {
  const [ollamaModels, openclawInfo] = await Promise.all([
    detectOllamaModels(),
    detectOpenClawAuth(),
  ]);

  return {
    local: ollamaModels,
    cloud: openclawInfo.models,
    hasApiKey: openclawInfo.hasApiKey,
  };
}

/**
 * Detect locally installed Ollama models via the REST API.
 * GET http://localhost:11434/api/tags returns structured JSON with real
 * parameter counts, sizes, and quantization levels — no CLI parsing needed.
 */
async function detectOllamaModels() {
  try {
    const response = await fetchWithTimeout('http://localhost:11434/api/tags', 3000);
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.models || !Array.isArray(data.models)) return [];

    return data.models.map(m => {
      const name = (m.name || '').replace(':latest', '');
      if (!name) return null;

      // Use the real parameter count from the API when available
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
    // Ollama not running or not installed
    return [];
  }
}

/**
 * Format parameter count from Ollama API (e.g., "7B", "3.2B", "70B").
 * The API returns strings like "7B", "3.21B", etc. in details.parameter_size.
 */
function formatParamCount(paramSize) {
  if (!paramSize) return '';
  // Already formatted like "7B" or "3.2B"
  const s = String(paramSize).trim();
  if (/^\d+\.?\d*[BbMm]$/i.test(s)) return s.toUpperCase();
  return s;
}

/**
 * Fallback: estimate parameter count from file size.
 * Rough heuristic: ~0.5GB per billion parameters for Q4 quantization.
 */
function guessParamsFromSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / (1024 ** 3);
  const billions = Math.round(gb * 2); // Q4 ≈ 0.5GB/B
  if (billions > 0) return `~${billions}B`;
  return '';
}

/**
 * Format bytes into human-readable size (e.g., "4.7 GB").
 */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${Math.round(mb)} MB`;
}

/**
 * Fetch with timeout using AbortController (Node 18+).
 */
function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

/**
 * Check OpenClaw for configured models and API key status.
 */
async function detectOpenClawAuth() {
  const result = { models: [], hasApiKey: false };

  try {
    // Check if any API key is configured via openclaw models status
    const status = await execAsync('openclaw', ['models', 'status']);

    // Look for "api_key" or "configured" in the output
    if (status.includes('api_key') || status.includes('configured')) {
      result.hasApiKey = true;
    }

    // Get the model catalog for cloud options
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
      // Fall back to text parsing
      const text = await execAsync('openclaw', ['models', 'list']);
      const lines = text.trim().split('\n').filter(l => l.trim() && !l.startsWith('Model'));
      result.models = lines.map(l => {
        const id = l.trim().split(/\s+/)[0];
        if (!id || id.length < 3) return null;
        return { id, name: modelShortName(id), provider: id.split('/')[0], tier: 'cloud' };
      }).filter(Boolean);
    }
  } catch {
    // OpenClaw not installed or no models configured — use defaults
    result.models = [
      { id: 'anthropic/claude-haiku-4-20250414', name: 'Haiku', provider: 'anthropic', tier: 'cloud' },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Sonnet', provider: 'anthropic', tier: 'cloud' },
    ];
  }

  return result;
}

/**
 * Short display name for a model ID.
 */
export function modelShortName(model) {
  if (!model) return 'unknown';
  // Anthropic models
  if (model.startsWith('anthropic/')) {
    if (model.includes('haiku')) return 'Haiku';
    if (model.includes('sonnet')) return 'Sonnet';
    if (model.includes('opus')) return 'Opus';
    return model.slice('anthropic/'.length);
  }
  // Ollama models
  if (model.startsWith('ollama/')) return model.slice('ollama/'.length);
  // Other: strip provider prefix
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
