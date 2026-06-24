import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { minimatch } from 'minimatch';

const execFileAsync = promisify(execFile);

export interface BundleSizeResult {
  totalBytes: number;
}

export async function measureBundleSize(
  projectDir: string,
  ignorePatterns: string[] = [],
): Promise<BundleSizeResult> {
  const outputDir = await mkdtemp(join(tmpdir(), 'eas-preflight-export-'));

  try {
    // Exported per-platform (never "all") so this never invokes expo-router's
    // web static-render step: it has its own failure modes unrelated to
    // actual app size, and web bundle bytes don't count toward a native
    // App Store/Play Store binary anyway.
    //
    // --clear forces a fresh Metro cache: without it, measuring two
    // different checkouts back-to-back (head, then base ref) can return a
    // stale cached bundle from the other checkout, silently corrupting the
    // comparison (observed: base ref measured ~3x its real size, matching
    // head almost exactly).
    await Promise.all(
      (['ios', 'android'] as const).map((platform) =>
        execFileAsync(
          'npx',
          [
            'expo',
            'export',
            '--platform',
            platform,
            '--output-dir',
            join(outputDir, platform),
            '--clear',
          ],
          { cwd: projectDir, env: { ...process.env, CI: '1' } },
        ),
      ),
    );

    let totalBytes = 0;

    // Sum each platform separately, with paths relative to that platform's
    // own export root, so ignore patterns (e.g. "assets/**") match what the
    // user actually sees in their Expo project rather than the ios/android
    // subdirectory this function adds internally.
    for (const platform of ['ios', 'android'] as const) {
      const platformDir = join(outputDir, platform);
      totalBytes += await sumDirectorySize(platformDir, platformDir, ignorePatterns);
    }

    return { totalBytes };
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

// Sourcemaps never ship to the device; counting them would make the size
// comparison meaningless since they often dwarf the actual bundle.
async function sumDirectorySize(
  dir: string,
  baseDir: string,
  ignorePatterns: string[],
): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let total = 0;

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    const relativePath = relative(baseDir, entryPath).split(sep).join('/');

    if (ignorePatterns.some((pattern) => minimatch(relativePath, pattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      total += await sumDirectorySize(entryPath, baseDir, ignorePatterns);
    } else if (!entry.name.endsWith('.map')) {
      total += (await stat(entryPath)).size;
    }
  }

  return total;
}
