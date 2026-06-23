import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface BundleSizeResult {
  totalBytes: number;
}

export async function measureBundleSize(projectDir: string): Promise<BundleSizeResult> {
  const outputDir = await mkdtemp(join(tmpdir(), 'eas-preflight-export-'));

  try {
    await execFileAsync(
      'npx',
      ['expo', 'export', '--platform', 'all', '--output-dir', outputDir],
      { cwd: projectDir, env: { ...process.env, CI: '1' } },
    );

    return { totalBytes: await sumDirectorySize(outputDir) };
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

// Sourcemaps never ship to the device; counting them would make the size
// comparison meaningless since they often dwarf the actual bundle.
async function sumDirectorySize(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      total += await sumDirectorySize(entryPath);
    } else if (!entry.name.endsWith('.map')) {
      total += (await stat(entryPath)).size;
    }
  }

  return total;
}
