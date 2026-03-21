import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { info, success, warn, error, spinner, bold, dim, green, cyan, printHeader, fileStatus } from '../utils/ui.js';

const MANIFEST = [
  '.skills/auth/SKILL.md',
  '.skills/db-migrate/SKILL.md',
  '.skills/deploy/SKILL.md',
  '.skills/dev-server/SKILL.md',
  '.skills/find-skills/SKILL.md',
  '.skills/generate-skills/SKILL.md',
  '.skills/git-workflow/SKILL.md',
  '.skills/model-routing/SKILL.md',
  '.skills/scaffold/SKILL.md',
  '.skills/test/SKILL.md',
  '.openclaw/SOUL.md',
  '.openclaw/agents/log-watcher/AGENT.md',
  '.openclaw/agents/test-runner/AGENT.md',
  '.openclaw/agents/skill-maintainer/AGENT.md',
  'SKILL-AUTHORING.md',
];

// OpenClaw files that are meant to be customized — warn before overwriting
const CUSTOMIZABLE = new Set([
  '.openclaw/SOUL.md',
  '.openclaw/agents/log-watcher/AGENT.md',
  '.openclaw/agents/test-runner/AGENT.md',
  '.openclaw/agents/skill-maintainer/AGENT.md',
]);

export async function skillsUpdate({ force = false, all = false } = {}) {
  printHeader();

  const results = { updated: 0, skipped: 0, unchanged: 0, failed: 0 };
  const spin = spinner('Checking for updates...');
  const logs = [];

  try {
    for (const repoPath of MANIFEST) {
      const destPath = join(process.cwd(), repoPath);

      if (!existsSync(destPath) && !all) {
        logs.push(fileStatus(repoPath, 'skipped', `not installed \u2014 use ${bold('--all')} to add`));
        results.skipped++;
        continue;
      }

      try {
        const content = await downloadFile(repoPath);

        if (existsSync(destPath)) {
          const local = readFileSync(destPath, 'utf8');
          if (local === content) {
            logs.push(fileStatus(repoPath, 'unchanged'));
            results.unchanged++;
            continue;
          }

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
  console.log(`  ${parts.join(dim(' · '))}`);

  if (results.updated > 0) {
    console.log();
    info(`${dim('Only base SerpentStack files were updated — your custom skills are untouched.')}`);
  }
  console.log();
}
