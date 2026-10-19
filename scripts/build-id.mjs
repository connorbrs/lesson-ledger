// Short build identifier shown in Settings: CI commit SHA, else local git short hash, else 'dev'.
import { execSync } from 'node:child_process';

export function buildId() {
  const sha = process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 6);
  try {
    return execSync('git rev-parse --short=6 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}
