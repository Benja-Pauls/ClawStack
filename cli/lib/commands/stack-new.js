import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { cloneRepo, checkGit } from '../utils/github.js';
import { info, success, error, spinner, bold, dim, green, printBox, printPrompt } from '../utils/ui.js';

const CLEANUP_PATHS = [
  'cli',
  'references',
  'BRIEF.md',
  'PRINCIPLES.md',
];

function validateName(name) {
  if (!name) return 'Project name is required';
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return 'Name must start with a letter and contain only letters, numbers, hyphens, and underscores';
  }
  return null;
}

export async function stackNew(name) {
  const nameError = validateName(name);
  if (nameError) {
    error(nameError);
    console.log(`\n  Usage: ${bold('serpentstack stack new <project-name>')}\n`);
    process.exit(1);
  }

  const dest = resolve(process.cwd(), name);

  if (existsSync(dest)) {
    error(`Directory ${bold(name)} already exists`);
    process.exit(1);
  }

  const hasGit = await checkGit();
  if (!hasGit) {
    error('git is not installed. Install git first: https://git-scm.com/downloads');
    process.exit(1);
  }

  console.log();

  // Clone
  const spin = spinner(`Cloning SerpentStack template into ${name}/...`);
  try {
    await cloneRepo(dest);
    spin.stop(success(`Template cloned into ${green(name)}/`));
  } catch (err) {
    spin.stop();
    error(err.message);
    process.exit(1);
  }

  // Clean up repo-specific files
  for (const p of CLEANUP_PATHS) {
    const full = join(dest, p);
    if (existsSync(full)) {
      await rm(full, { recursive: true, force: true });
    }
  }

  // Initialize fresh git repo
  await new Promise((resolve, reject) => {
    execFile('git', ['init'], { cwd: dest }, (err) => {
      if (err) reject(new Error(`git init failed: ${err.message}`));
      else resolve();
    });
  });
  success('Initialized fresh git repository');

  // What was created
  console.log();
  console.log(`  ${dim('Includes:')}`);
  console.log(`  ${green('\u2713')} FastAPI backend with async SQLAlchemy + JWT auth`);
  console.log(`  ${green('\u2713')} React frontend with TypeScript + shadcn/ui`);
  console.log(`  ${green('\u2713')} PostgreSQL + Redis via Docker Compose`);
  console.log(`  ${green('\u2713')} Terraform infrastructure (AWS App Runner)`);
  console.log(`  ${green('\u2713')} 10 project-specific Agent Skills in .skills/`);
  console.log(`  ${green('\u2713')} OpenClaw persistent agent configs in .openclaw/`);
  console.log();

  printBox('Get started', [
    `${dim('$')} ${bold(`cd ${name}`)}`,
    `${dim('$')} ${bold('make init')}      ${dim('# interactive project setup')}`,
    `${dim('$')} ${bold('make setup')}     ${dim('# install dependencies')}`,
    `${dim('$')} ${bold('make dev')}       ${dim('# start dev server')}`,
    '',
    `Then open your IDE agent and start building.`,
    `The agent reads ${bold('.skills/')} automatically.`,
  ]);

  printPrompt('Add a Projects resource with CRUD, auth, and ownership');
}
