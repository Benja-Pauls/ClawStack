import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { info, success, warn, error, spinner, bold, dim, green, fileStatus } from '../utils/ui.js';

const MANIFEST = [
  '.skills/find-skills/SKILL.md',
  '.skills/generate-skills/SKILL.md',
  '.skills/git-workflow/SKILL.md',
  '.skills/model-routing/SKILL.md',
  '.openclaw/SOUL.md',
  '.openclaw/HEARTBEAT.md',
  '.openclaw/AGENTS.md',
  'SKILL-AUTHORING.md',
];

// OpenClaw files are meant to be customized — warn before overwriting
const CUSTOMIZABLE = new Set(['.openclaw/SOUL.md', '.openclaw/HEARTBEAT.md', '.openclaw/AGENTS.md']);

export async function skillsUpdate({ force = false, all = false } = {}) {
  console.log();
  info(`Updating SerpentStack skills in ${bold(process.cwd())}`);
  console.log();

  const results = { updated: 0, skipped: 0, unchanged: 0, failed: 0 };
  const spin = spinner('Checking for updates...');
  const logs = [];

  try {
    for (const repoPath of MANIFEST) {
      const destPath = join(process.cwd(), repoPath);

      // By default, only update files that already exist locally
      if (!existsSync(destPath) && !all) {
        logs.push(fileStatus(repoPath, 'skipped', `not installed \u2014 use ${bold('--all')} to add`));
        results.skipped++;
        continue;
      }

      try {
        const content = await downloadFile(repoPath);

        // Check if local content is identical
        if (existsSync(destPath)) {
          const local = readFileSync(destPath, 'utf8');
          if (local === content) {
            logs.push(fileStatus(repoPath, 'unchanged'));
            results.unchanged++;
            continue;
          }

          // Warn about customizable files
          if (CUSTOMIZABLE.has(repoPath) && !force) {
            logs.push(fileStatus(repoPath, 'skipped', `local changes \u2014 use ${bold('--force')} to overwrite`));
            results.skipped++;
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

  for (const log of logs) console.log(log);
  console.log();

  // Summary line
  const parts = [];
  if (results.updated > 0) parts.push(green(`${results.updated} updated`));
  if (results.unchanged > 0) parts.push(`${results.unchanged} up to date`);
  if (results.skipped > 0) parts.push(`${results.skipped} skipped`);
  if (results.failed > 0) parts.push(`${results.failed} failed`);
  console.log(`  ${parts.join(dim(' \u2022 '))}`);
  console.log();
}
