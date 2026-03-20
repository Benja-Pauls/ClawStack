import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { readConfig, writeConfig, detectTemplateDefaults, defaultAgentConfig } from '../utils/config.js';
import { parseAgentMd, discoverAgents } from '../utils/agent-utils.js';
import { info, success, warn, error, spinner, bold, dim, green, printBox, printPrompt, printHeader, fileStatus } from '../utils/ui.js';

const SKILLS_FILES = [
  '.skills/find-skills/SKILL.md',
  '.skills/generate-skills/SKILL.md',
  '.skills/git-workflow/SKILL.md',
  '.skills/model-routing/SKILL.md',
];

const OPENCLAW_FILES = [
  '.openclaw/SOUL.md',
  '.openclaw/agents/log-watcher/AGENT.md',
  '.openclaw/agents/test-runner/AGENT.md',
  '.openclaw/agents/skill-maintainer/AGENT.md',
];

const DOCS_FILES = [
  'SKILL-AUTHORING.md',
];

const MANIFEST = [...SKILLS_FILES, ...OPENCLAW_FILES, ...DOCS_FILES];

export async function skillsInit({ force = false } = {}) {
  printHeader();

  // Step 1: Download files
  console.log(`  ${bold('Downloading')} ${dim('skills + persistent agent configs')}`);
  console.log();

  const results = { created: 0, skipped: 0, overwritten: 0, unchanged: 0, failed: 0 };
  const logs = [];
  const spin = spinner('Fetching from GitHub...');

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
  console.log(`  ${dim('IDE Agent Skills')}`);
  for (let i = 0; i < SKILLS_FILES.length; i++) logs[i] && console.log(logs[i]);
  console.log();
  console.log(`  ${dim('Persistent Agent (OpenClaw)')}`);
  for (let i = SKILLS_FILES.length; i < SKILLS_FILES.length + OPENCLAW_FILES.length; i++) logs[i] && console.log(logs[i]);
  console.log();
  console.log(`  ${dim('Documentation')}`);
  for (let i = SKILLS_FILES.length + OPENCLAW_FILES.length; i < logs.length; i++) logs[i] && console.log(logs[i]);
  console.log();

  // Summary line
  const parts = [];
  if (results.created > 0) parts.push(green(`${results.created} created`));
  if (results.overwritten > 0) parts.push(`${results.overwritten} updated`);
  if (results.unchanged > 0) parts.push(`${results.unchanged} up to date`);
  if (results.skipped > 0) parts.push(`${results.skipped} skipped`);
  if (results.failed > 0) parts.push(`${results.failed} failed`);
  console.log(`  ${parts.join(dim(' \u2022 '))}`);

  if (results.failed === MANIFEST.length) {
    console.log();
    error('All downloads failed. Check your internet connection and try again.');
    return;
  }

  // Generate default config.json if it doesn't exist
  const projectDir = process.cwd();
  if (!readConfig(projectDir)) {
    const templateDefaults = detectTemplateDefaults(projectDir) || {};
    const config = {
      project: {
        name: templateDefaults.name || '',
        language: templateDefaults.language || '',
        framework: templateDefaults.framework || '',
        devCmd: templateDefaults.devCmd || '',
        testCmd: templateDefaults.testCmd || '',
        conventions: templateDefaults.conventions || '',
      },
      agents: {},
    };

    // Populate agent defaults from downloaded AGENT.md files
    const agents = discoverAgents(projectDir);
    for (const agent of agents) {
      try {
        const agentMd = parseAgentMd(agent.agentMdPath);
        config.agents[agent.name] = defaultAgentConfig(agentMd.meta);
      } catch { /* skip invalid agents */ }
    }

    writeConfig(projectDir, config);
    console.log(`  ${fileStatus('.openclaw/config.json', 'created')}`);
    results.created++;
    console.log();
  }

  // Next steps
  console.log();
  console.log(`  ${bold('Next')} ${dim('\u2014 Generate project-specific skills')}`);
  console.log();
  console.log(`  ${dim('Open your IDE agent (Claude Code, Cursor, Copilot, etc.)')}`);
  console.log(`  ${dim('and paste the prompt below. The agent will read your codebase,')}`);
  console.log(`  ${dim('interview you about your conventions, and produce a full')}`);
  console.log(`  ${dim('.skills/ directory tailored to your project.')}`);

  printPrompt([
    `Read .skills/generate-skills/SKILL.md and follow its instructions`,
    `to generate project-specific skills for this codebase. If`,
    `.openclaw/config.json exists, read it first — it has my project`,
    `name, language, framework, and conventions. Interview me about my`,
    `architecture decisions — transactions, auth, error patterns,`,
    `testing strategy, and deployment. Ask about the business domain`,
    `too: what this app does, key user flows, and where agents are`,
    `most likely to make mistakes. Write each skill as a SKILL.md with`,
    `complete templates an agent can copy, not vague descriptions.`,
    `Reference SKILL-AUTHORING.md for the format.`,
  ]);

  printBox('After generating skills, try setting up persistent agents too', [
    `${dim('$')} ${bold('serpentstack persistent')}  ${dim('# choose agents + launch')}`,
    '',
    `${dim('Background agents that watch your dev server, run tests,')}`,
    `${dim('and keep your skills up to date. Each opens in its own')}`,
    `${dim('terminal window. Pick which to run and choose your models.')}`,
  ]);
}
