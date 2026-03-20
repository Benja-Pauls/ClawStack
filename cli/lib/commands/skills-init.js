import { join } from 'node:path';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { info, success, warn, error, spinner, bold, dim, green, printBox, printPrompt, fileStatus } from '../utils/ui.js';

const SKILLS_FILES = [
  '.skills/find-skills/SKILL.md',
  '.skills/generate-skills/SKILL.md',
  '.skills/git-workflow/SKILL.md',
  '.skills/model-routing/SKILL.md',
];

const OPENCLAW_FILES = [
  '.openclaw/SOUL.md',
  '.openclaw/HEARTBEAT.md',
  '.openclaw/AGENTS.md',
];

const DOCS_FILES = [
  'SKILL-AUTHORING.md',
];

const MANIFEST = [...SKILLS_FILES, ...OPENCLAW_FILES, ...DOCS_FILES];

export async function skillsInit({ force = false } = {}) {
  console.log();
  info(`Downloading SerpentStack skills into ${bold(process.cwd())}`);
  console.log();

  const results = { created: 0, skipped: 0, overwritten: 0, failed: 0 };
  const logs = [];
  const spin = spinner('Downloading files from GitHub...');

  try {
    for (const repoPath of MANIFEST) {
      const destPath = join(process.cwd(), repoPath);
      try {
        const content = await downloadFile(repoPath);
        const status = safeWrite(destPath, content, { force });
        results[status]++;
        logs.push(fileStatus(repoPath, status, 'use --force to overwrite'));
      } catch (err) {
        results.failed++;
        logs.push(fileStatus(repoPath, 'failed', err.message));
      }
    }
  } finally {
    spin.stop();
  }

  // Group output by section
  console.log(`  ${bold('IDE Agent Skills')}`);
  for (let i = 0; i < SKILLS_FILES.length; i++) logs[i] && console.log(logs[i]);
  console.log();
  console.log(`  ${bold('Persistent Agent (OpenClaw)')}`);
  for (let i = SKILLS_FILES.length; i < SKILLS_FILES.length + OPENCLAW_FILES.length; i++) logs[i] && console.log(logs[i]);
  console.log();
  console.log(`  ${bold('Documentation')}`);
  for (let i = SKILLS_FILES.length + OPENCLAW_FILES.length; i < logs.length; i++) logs[i] && console.log(logs[i]);
  console.log();

  // Summary line
  const parts = [];
  if (results.created > 0) parts.push(green(`${results.created} created`));
  if (results.overwritten > 0) parts.push(`${results.overwritten} updated`);
  if (results.skipped > 0) parts.push(`${results.skipped} skipped`);
  if (results.failed > 0) parts.push(`${results.failed} failed`);
  console.log(`  ${parts.join(dim(' \u2022 '))}`);
  console.log();

  // Next steps with copyable prompt
  if (results.failed === MANIFEST.length) {
    error('All downloads failed. Check your internet connection and try again.');
    return;
  }

  printBox('Next steps', [
    `${bold('1.')} Open your IDE agent (Claude Code, Cursor, Copilot, etc.)`,
    `   and give it the prompt below to generate project-specific skills.`,
    '',
    `${bold('2.')} Start the persistent background agent:`,
    `   ${dim('$')} ${bold('serpentstack skills persistent --start')}`,
    '',
    `${bold('3.')} Customize your persistent agent identity:`,
    `   ${dim('$')} ${bold('serpentstack skills persistent --create')}`,
  ]);

  printPrompt([
    `Read .skills/generate-skills/SKILL.md and follow its instructions`,
    `to generate project-specific skills for this codebase. Interview me`,
    `about my architecture decisions — how I handle transactions, auth,`,
    `error patterns, testing strategy, and deployment. Ask about the`,
    `business domain too: what this app does, key user flows, and where`,
    `agents are most likely to make mistakes. Write each skill as a`,
    `SKILL.md with complete templates an agent can copy, not vague`,
    `descriptions. Reference SKILL-AUTHORING.md for the format.`,
  ]);
}
