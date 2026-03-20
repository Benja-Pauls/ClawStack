import { join } from 'node:path';
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

export async function skillsInit({ force = false } = {}) {
  info(`Downloading SerpentStack skills into ${bold(process.cwd())}`);
  console.log();

  const results = { created: 0, skipped: 0, overwritten: 0, failed: 0 };
  const spin = spinner('Downloading files from GitHub...');

  try {
    for (const repoPath of MANIFEST) {
      const destPath = join(process.cwd(), repoPath);
      try {
        const content = await downloadFile(repoPath);
        const status = safeWrite(destPath, content, { force });
        results[status]++;

        const icon = status === 'created' ? '\u2713'
          : status === 'overwritten' ? '\u21BB'
          : '\u2022';
        const label = status === 'skipped' ? dim(`${repoPath} (exists, skipped)`)
          : status === 'overwritten' ? `${repoPath} (updated)`
          : repoPath;

        // Buffer output — will show after spinner stops
        results[`_log_${repoPath}`] = `  ${icon} ${label}`;
      } catch (err) {
        results.failed++;
        results[`_log_${repoPath}`] = `  \u2717 ${repoPath} — ${err.message}`;
      }
    }
  } finally {
    spin.stop();
  }

  // Print file results
  for (const repoPath of MANIFEST) {
    console.log(results[`_log_${repoPath}`]);
  }
  console.log();

  // Summary
  if (results.created > 0) success(`${results.created} file(s) created`);
  if (results.overwritten > 0) success(`${results.overwritten} file(s) updated`);
  if (results.skipped > 0) warn(`${results.skipped} file(s) skipped (already exist — use ${bold('--force')} to overwrite)`);
  if (results.failed > 0) error(`${results.failed} file(s) failed to download`);

  // Next steps
  console.log();
  info(bold('Next steps:'));
  console.log(`  1. Open your IDE agent and say: ${bold('"generate skills for my project"')}`);
  console.log(`  2. Start the persistent agent: ${bold('serpentstack skills persistent --start')}`);
  console.log();
}
