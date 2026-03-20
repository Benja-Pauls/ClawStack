import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Write content to a file with overwrite protection.
 *
 * @param {string} destPath - Absolute or relative path to write to
 * @param {string} content  - File content
 * @param {{ force?: boolean }} options
 * @returns {'created' | 'overwritten' | 'skipped'}
 */
export function safeWrite(destPath, content, { force = false } = {}) {
  mkdirSync(dirname(destPath), { recursive: true });

  if (existsSync(destPath)) {
    if (!force) {
      return 'skipped';
    }
    // Don't overwrite if content is identical
    try {
      const existing = readFileSync(destPath, 'utf8');
      if (existing === content) return 'unchanged';
    } catch { /* proceed with overwrite */ }

    writeFileSync(destPath, content, 'utf8');
    return 'overwritten';
  }

  writeFileSync(destPath, content, 'utf8');
  return 'created';
}
