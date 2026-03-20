import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const GITHUB_REPO = process.env.SERPENTSTACK_REPO || 'Benja-Pauls/SerpentStack';
const GITHUB_BRANCH = process.env.SERPENTSTACK_BRANCH || 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const CLONE_URL = `https://github.com/${GITHUB_REPO}.git`;

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `token ${token}` } : {};
}

/**
 * Download a single file from the SerpentStack repo.
 * Returns the file content as a string.
 * Retries once on network failure.
 */
export async function downloadFile(repoPath) {
  const url = `${RAW_BASE}/${repoPath}`;
  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 404) {
        throw new Error(`File not found: ${repoPath} (checked ${url})`);
      }
      if (!res.ok) {
        throw new Error(`GitHub returned ${res.status} for ${repoPath}`);
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt === 0 && err.cause?.code === 'ENOTFOUND') {
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * Clone the SerpentStack repo into `dest` with --depth=1.
 * Removes .git/ after cloning so the user starts fresh.
 */
export async function cloneRepo(dest) {
  await new Promise((resolve, reject) => {
    execFile('git', ['clone', '--depth=1', CLONE_URL, dest], (err, _stdout, stderr) => {
      if (err) {
        const msg = stderr?.includes('not found')
          ? `Could not clone ${CLONE_URL}. Check your internet connection.`
          : `git clone failed: ${stderr || err.message}`;
        reject(new Error(msg));
      } else {
        resolve();
      }
    });
  });

  await rm(join(dest, '.git'), { recursive: true, force: true });
}

/**
 * Check if git is installed.
 */
export function checkGit() {
  return new Promise((resolve) => {
    execFile('git', ['--version'], (err) => resolve(!err));
  });
}
