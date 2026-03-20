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
 * Detect locally installed Ollama models with parameter counts.
 * Parses `ollama list` output.
 */
async function detectOllamaModels() {
  try {
    const output = await execAsync('ollama', ['list']);
    const lines = output.trim().split('\n');
    if (lines.length < 2) return []; // header only

    // Parse header to find column positions
    const header = lines[0];
    const nameEnd = header.indexOf('ID');
    const sizeStart = header.indexOf('SIZE');

    return lines.slice(1).map(line => {
      if (!line.trim()) return null;

      const name = line.slice(0, nameEnd).trim();
      if (!name) return null;

      // Extract size (e.g., "4.7 GB", "1.3 GB")
      const sizeStr = sizeStart >= 0 ? line.slice(sizeStart).trim().split(/\s{2,}/)[0] : '';

      // Estimate parameter count from model name (e.g., "llama3.2:3b", "qwen2.5-coder:7b")
      const paramMatch = name.match(/[:\-](\d+\.?\d*)[bB]/);
      const params = paramMatch ? paramMatch[1] + 'B' : guessParams(name, sizeStr);

      const shortName = name.replace(':latest', '');

      return {
        id: `ollama/${shortName}`,
        name: shortName,
        params,
        size: sizeStr,
        tier: 'local',
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Guess parameter count from file size if not in the name.
 * Rough heuristic: ~0.5GB per billion parameters for Q4 quantization.
 */
function guessParams(name, sizeStr) {
  const gbMatch = sizeStr.match(/([\d.]+)\s*GB/i);
  if (gbMatch) {
    const gb = parseFloat(gbMatch[1]);
    const billions = Math.round(gb * 2); // Q4 ≈ 0.5GB/B
    if (billions > 0) return `~${billions}B`;
  }
  return '';
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
