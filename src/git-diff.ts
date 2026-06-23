import { execFile } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
): Promise<SizeComparison> {
  const worktreeDir = await mkdtemp(join(tmpdir(), 'eas-preflight-worktree-'));

  try {
    await execFileAsync('git', ['worktree', 'add', '--detach', worktreeDir, baseRef], {
      cwd: projectDir,
    });

    // Reuse the head checkout's node_modules instead of reinstalling for the
    // base ref; acceptable for v1 since dependency trees rarely change
    // between adjacent commits, but means a real dependency bump on the PR
    // branch won't be reflected when measuring the base ref.
    await symlink(join(projectDir, 'node_modules'), join(worktreeDir, 'node_modules'));

    const baseSize = await measureBundleSize(worktreeDir);
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
