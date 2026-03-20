import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { cloneRepo, checkGit } from '../utils/github.js';
import { info, success, error, spinner, bold } from '../utils/ui.js';

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

  // Clone
  const spin = spinner(`Cloning SerpentStack template into ${name}/...`);
  try {
    await cloneRepo(dest);
    spin.stop(success(`Template cloned into ${bold(name)}/`));
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

  // Next steps
  console.log();
  info(bold('Next steps:'));
  console.log(`  cd ${name}`);
  console.log(`  make init      ${bold('#')} interactive project setup`);
  console.log(`  make setup     ${bold('#')} install dependencies`);
  console.log(`  make dev       ${bold('#')} start dev server`);
  console.log();
}
