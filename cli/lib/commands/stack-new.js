import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { cloneRepo, checkGit } from '../utils/github.js';
import { info, success, warn, error, spinner, bold, dim, green, cyan, printBox, printPrompt, printHeader } from '../utils/ui.js';

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

function checkCommand(cmd) {
  return new Promise((resolve) => {
    execFile('which', [cmd], (err) => resolve(!err));
  });
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

  printHeader();

  // Step 1: Check prerequisites
  console.log(`  ${bold('Step 1/4')} ${dim('\u2014 Checking prerequisites')}`);
  console.log();

  const checks = [
    { cmd: 'git', label: 'git', url: 'https://git-scm.com/downloads' },
    { cmd: 'python3', label: 'Python 3.12+', url: 'https://python.org/downloads' },
    { cmd: 'node', label: 'Node 22+', url: 'https://nodejs.org' },
    { cmd: 'docker', label: 'Docker', url: 'https://docker.com/get-started' },
    { cmd: 'uv', label: 'uv (Python package manager)', url: 'https://docs.astral.sh/uv' },
  ];

  let missing = [];
  for (const { cmd, label, url } of checks) {
    const found = await checkCommand(cmd);
    if (found) {
      console.log(`  ${green('\u2713')} ${label}`);
    } else {
      console.log(`  ${dim('\u2022')} ${dim(label)} ${dim(`\u2014 install: ${url}`)}`);
      missing.push(label);
    }
  }
  console.log();

  if (missing.length > 0) {
    // git is required to clone — everything else is needed later
    const gitMissing = !(await checkCommand('git'));
    if (gitMissing) {
      error(`git is required to scaffold the project. Install it first: https://git-scm.com/downloads`);
      process.exit(1);
    }
    warn(`Missing: ${bold(missing.join(', '))}. You can install these before running ${bold('make setup')}.`);
    console.log();
  }

  // Step 2: Clone template
  console.log(`  ${bold('Step 2/4')} ${dim('\u2014 Cloning template')}`);
  console.log();

  const spin = spinner(`Downloading SerpentStack template...`);
  try {
    await cloneRepo(dest);
    spin.stop(success(`Template cloned into ${green(name)}/`));
  } catch (err) {
    spin.stop();
    error(err.message);
    process.exit(1);
  }

  // Step 3: Clean up repo-specific files
  console.log();
  console.log(`  ${bold('Step 3/4')} ${dim('\u2014 Preparing project')}`);
  console.log();

  for (const p of CLEANUP_PATHS) {
    const full = join(dest, p);
    if (existsSync(full)) {
      await rm(full, { recursive: true, force: true });
    }
  }
  success('Removed SerpentStack repo files');

  await new Promise((resolve, reject) => {
    execFile('git', ['init'], { cwd: dest }, (err) => {
      if (err) reject(new Error(`git init failed: ${err.message}`));
      else resolve();
    });
  });
  success('Initialized fresh git repository');

  // Step 4: Summary
  console.log();
  console.log(`  ${bold('Step 4/4')} ${dim('\u2014 Done!')}`);
  console.log();

  console.log(`  ${dim('Your project includes:')}`);
  console.log(`  ${green('\u2713')} FastAPI backend ${dim('(async SQLAlchemy, JWT auth, ownership enforcement)')}`);
  console.log(`  ${green('\u2713')} React frontend ${dim('(TypeScript, Vite, shadcn/ui)')}`);
  console.log(`  ${green('\u2713')} PostgreSQL + Redis ${dim('(Docker Compose)')}`);
  console.log(`  ${green('\u2713')} Terraform infrastructure ${dim('(AWS App Runner, RDS, ECR)')}`);
  console.log(`  ${green('\u2713')} 10 project-specific Agent Skills ${dim('(.skills/)')}`);
  console.log(`  ${green('\u2713')} Persistent agent configs ${dim('(.openclaw/)')}`);
  console.log();

  printBox('Get started', [
    `${dim('$')} ${bold(`cd ${name}`)}`,
    `${dim('$')} ${bold('make init')}      ${dim('# set project name, DB config')}`,
    `${dim('$')} ${bold('make setup')}     ${dim('# install Python + Node dependencies')}`,
    `${dim('$')} ${bold('make dev')}       ${dim('# start Postgres + Redis + backend + frontend')}`,
    '',
    `${dim('Then open your IDE agent and try the prompt below.')}`,
    `${dim('The agent discovers .skills/ automatically.')}`,
  ]);

  printPrompt([
    `Read .skills/scaffold/SKILL.md and add a Projects resource with`,
    `full CRUD, JWT auth, and ownership enforcement. Follow the`,
    `service/route/test/frontend patterns exactly as the skill`,
    `describes. Run make verify when done to confirm everything passes.`,
  ], { hint: 'Try this prompt to verify your skills are working' });
}
