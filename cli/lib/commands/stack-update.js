import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { info, success, warn, error, spinner, bold, dim, green, printHeader, fileStatus, printSnakeList } from '../utils/ui.js';

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
    error('Not a SerpentStack project.');
    console.log(`\n  Run this from a directory created with ${bold('serpentstack stack new')}.\n`);
    process.exit(1);
  }

  printHeader();

  info(`Checking for template updates in ${bold(process.cwd())}`);
  console.log();

  const results = { updated: 0, unchanged: 0, failed: 0 };
  const spin = spinner('Comparing with latest template...');
  const logs = [];

  try {
    for (const repoPath of TEMPLATE_FILES) {
      const destPath = join(process.cwd(), repoPath);
      try {
        const content = await downloadFile(repoPath);

        if (existsSync(destPath)) {
          const local = readFileSync(destPath, 'utf8');
          if (local === content) {
            logs.push(fileStatus(repoPath, 'unchanged'));
            results.unchanged++;
            continue;
          }
        }

        const status = safeWrite(destPath, content, { force: true });
        logs.push(fileStatus(repoPath, status === 'created' ? 'created' : 'overwritten'));
        results.updated++;
      } catch (err) {
        results.failed++;
        logs.push(fileStatus(repoPath, 'failed', err.message));
      }
    }
  } finally {
    spin.stop();
  }

  printSnakeList(logs);
  console.log();

  // Summary line
  const parts = [];
  if (results.updated > 0) parts.push(green(`${results.updated} updated`));
  if (results.unchanged > 0) parts.push(`${results.unchanged} up to date`);
  if (results.failed > 0) parts.push(`${results.failed} failed`);
  console.log(`  ${parts.join(dim(' \u2022 '))}`);

  if (results.updated > 0) {
    console.log();
    info(`${dim('Review changes with')} ${bold('git diff')} ${dim('before committing.')}`);
  }

  // Also offer skills update
  console.log();
  info(`${dim('To also update skills:')} ${bold('serpentstack skills update')}`);
  console.log();
}
