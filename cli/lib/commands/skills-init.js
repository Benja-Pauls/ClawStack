import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { downloadFile } from '../utils/github.js';
import { safeWrite } from '../utils/fs-helpers.js';
import { readConfig, writeConfig, detectProjectDefaults, detectTemplateDefaults, defaultAgentConfig } from '../utils/config.js';
import { parseAgentMd, discoverAgents } from '../utils/agent-utils.js';
import { info, success, warn, error, spinner, bold, dim, green, cyan, divider, printBox, printPrompt, printHeader, fileStatus } from '../utils/ui.js';

const SKILLS_FILES = [
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

  const results = { created: 0, skipped: 0, overwritten: 0, unchanged: 0, failed: 0 };
  const logs = [];
  const spin = spinner('Slithering through GitHub...');

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
  divider('Skills');
  for (let i = 0; i < SKILLS_FILES.length; i++) logs[i] && console.log(logs[i]);
  console.log();

  divider('Persistent Agents');
  for (let i = SKILLS_FILES.length; i < SKILLS_FILES.length + OPENCLAW_FILES.length; i++) logs[i] && console.log(logs[i]);
  console.log();

  divider('Docs');
  for (let i = SKILLS_FILES.length + OPENCLAW_FILES.length; i < logs.length; i++) logs[i] && console.log(logs[i]);
  console.log();

  // Summary line
  const parts = [];
  if (results.created > 0) parts.push(green(`${results.created} created`));
  if (results.overwritten > 0) parts.push(cyan(`${results.overwritten} updated`));
  if (results.unchanged > 0) parts.push(`${results.unchanged} up to date`);
  if (results.skipped > 0) parts.push(`${results.skipped} skipped`);
  if (results.failed > 0) parts.push(`${results.failed} failed`);
  console.log(`  ${parts.join(dim(' · '))}`);

  if (results.failed === MANIFEST.length) {
    console.log();
    error('All downloads failed. Check your internet connection and try again.');
    return;
  }

  // Generate default config.json if it doesn't exist
  const projectDir = process.cwd();
  if (!readConfig(projectDir)) {
    // Auto-detect project info from filesystem
    const detected = detectProjectDefaults(projectDir);
    // SerpentStack template overrides (more specific)
    const template = detectTemplateDefaults(projectDir);
    const config = {
      project: {
        name: template?.name || detected.name,
        language: template?.language || detected.language,
        framework: template?.framework || detected.framework,
        devCmd: template?.devCmd || detected.devCmd,
        testCmd: template?.testCmd || detected.testCmd,
        conventions: template?.conventions || detected.conventions,
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
  }

  // Next steps
  console.log();
  divider('What\'s next');
  console.log();
  console.log(`  ${dim('Open your IDE agent (Claude Code, Cursor, Copilot, Gemini CLI, etc.)')}`);
  console.log(`  ${dim('and paste this prompt. It reads your codebase and generates')}`);
  console.log(`  ${dim('project-specific skills tailored to your stack.')}`);

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

  printBox('Want persistent background agents too?', [
    `${dim('$')} ${bold('serpentstack persistent')}              ${dim('# first-time setup walkthrough')}`,
    '',
    `${dim('Configures your project, picks models, and launches')}`,
    `${dim('agents — each in its own terminal window.')}`,
  ]);
  console.log();
}
