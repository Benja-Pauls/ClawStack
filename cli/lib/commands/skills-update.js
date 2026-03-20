import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { info, success, warn, error, spinner, bold, dim } from '../utils/ui.js';

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
        logs.push(`  \u2022 ${dim(`${repoPath} (not installed — use ${bold('--all')} to add)`)}`);
        results.skipped++;
        continue;
      }

      try {
        const content = await downloadFile(repoPath);

        // Check if local content is identical
        if (existsSync(destPath)) {
          const local = readFileSync(destPath, 'utf8');
          if (local === content) {
            logs.push(`  \u2022 ${dim(`${repoPath} (up to date)`)}`);
            results.unchanged++;
            continue;
          }

          // Warn about customizable files
          if (CUSTOMIZABLE.has(repoPath) && !force) {
            logs.push(`  ! ${repoPath} (has local changes — use ${bold('--force')} to overwrite)`);
            results.skipped++;
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
  if (results.skipped > 0) warn(`${results.skipped} file(s) skipped`);
  if (results.failed > 0) error(`${results.failed} file(s) failed`);
  console.log();
}
