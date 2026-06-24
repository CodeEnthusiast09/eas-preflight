import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';
import { measureBundleSize, type BundleSizeResult } from './bundle-size.js';

const execFileAsync = promisify(execFile);

export interface SizeComparison {
  baseBytes: number;
  headBytes: number;
  deltaBytes: number;
  deltaPercent: number;
}

export async function compareToBaseRef(
  projectDir: string,
  baseRef: string,
  headSize: BundleSizeResult,
  ignorePatterns: string[] = [],
): Promise<SizeComparison> {
  const worktreeDir = await mkdtemp(join(tmpdir(), 'eas-preflight-worktree-'));

  try {
    // `git worktree add` checks out the whole repo, not just projectDir, so
    // in a monorepo (Expo app in a subdirectory) the project actually lands
    // at worktreeDir/<subpath>, not at worktreeDir itself.
    const { stdout: repoRoot } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: projectDir,
    });
    const baseProjectDir = join(worktreeDir, relative(repoRoot.trim(), projectDir));
    const resolvedBaseRef = await resolveBaseRef(projectDir, baseRef);

    await execFileAsync('git', ['worktree', 'add', '--detach', worktreeDir, resolvedBaseRef], {
      cwd: projectDir,
    });

    // Reuse the head checkout's node_modules instead of reinstalling for the
    // base ref; acceptable for v1 since dependency trees rarely change
    // between adjacent commits, but means a real dependency bump on the PR
    // branch won't be reflected when measuring the base ref.
    await symlink(join(projectDir, 'node_modules'), join(baseProjectDir, 'node_modules'));

    // .env* files are gitignored, so the worktree won't have them; apps that
    // read a required env var at module load time (Convex/Supabase URLs,
    // API base URLs, etc.) would otherwise crash the base-ref export.
    await symlinkEnvFiles(projectDir, baseProjectDir);

    const baseSize = await measureBundleSize(baseProjectDir, ignorePatterns);
    const deltaBytes = headSize.totalBytes - baseSize.totalBytes;
    const deltaPercent =
      baseSize.totalBytes === 0 ? 0 : (deltaBytes / baseSize.totalBytes) * 100;

    return {
      baseBytes: baseSize.totalBytes,
      headBytes: headSize.totalBytes,
      deltaBytes,
      deltaPercent,
    };
  } finally {
    await execFileAsync('git', ['worktree', 'remove', '--force', worktreeDir], {
      cwd: projectDir,
    }).catch(() => undefined);
    await rm(worktreeDir, { recursive: true, force: true });
  }
}

// actions/checkout never creates a local branch for the base ref, only a
// remote-tracking one (refs/remotes/origin/<baseRef>), even with
// fetch-depth: 0. `git worktree add --detach` does not fall back to a
// remote-tracking branch the way a plain `git checkout <branch>` would, so
// "main" alone fails with "invalid reference" in real CI. Try the bare ref
// first (works for local clones that already have the branch), then fall
// back to the origin-qualified ref.
async function resolveBaseRef(projectDir: string, baseRef: string): Promise<string> {
  const candidates = [baseRef, `origin/${baseRef}`];

  for (const candidate of candidates) {
    try {
      await execFileAsync('git', ['rev-parse', '--verify', candidate], { cwd: projectDir });
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`Could not resolve base ref "${baseRef}" (tried: ${candidates.join(', ')})`);
}

async function symlinkEnvFiles(projectDir: string, worktreeDir: string): Promise<void> {
  const entries = await readdir(projectDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.startsWith('.env') && !entry.name.endsWith('.example')) {
      await symlink(join(projectDir, entry.name), join(worktreeDir, entry.name));
    }
  }
}
