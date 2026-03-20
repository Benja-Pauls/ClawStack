import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { info, success, warn, error, spinner, bold, dim } from '../utils/ui.js';

// Template-level files that may be updated upstream
const TEMPLATE_FILES = [
  'Makefile',
  'docker-compose.yml',
  'scripts/init.py',
  '.cursorrules',
  '.github/copilot-instructions.md',
];

export async function stackUpdate({ force = false } = {}) {
  // Verify we're in a SerpentStack project
  if (!existsSync(join(process.cwd(), 'Makefile')) || !existsSync(join(process.cwd(), 'backend'))) {
    error('Not a SerpentStack project. Run this from a directory created with `serpentstack stack new`.');
    process.exit(1);
  }

  info(`Checking for template updates in ${bold(process.cwd())}`);
  console.log();

  const results = { updated: 0, unchanged: 0, failed: 0 };
  const spin = spinner('Fetching latest template files...');
  const logs = [];

  try {
    for (const repoPath of TEMPLATE_FILES) {
      const destPath = join(process.cwd(), repoPath);
      try {
        const content = await downloadFile(repoPath);

        if (existsSync(destPath)) {
          const local = readFileSync(destPath, 'utf8');
          if (local === content) {
            logs.push(`  \u2022 ${dim(`${repoPath} (up to date)`)}`);
            results.unchanged++;
            continue;
          }
        }

        const status = safeWrite(destPath, content, { force: true });
        logs.push(`  \u21BB ${repoPath} (${status})`);
        results.updated++;
      } catch (err) {
        results.failed++;
        logs.push(`  \u2717 ${repoPath} — ${err.message}`);
      }
    }
  } finally {
    spin.stop();
  }

  for (const log of logs) console.log(log);
  console.log();

  if (results.updated > 0) success(`${results.updated} file(s) updated`);
  if (results.unchanged > 0) info(`${results.unchanged} file(s) already up to date`);
  if (results.failed > 0) error(`${results.failed} file(s) failed`);
  console.log();
}
