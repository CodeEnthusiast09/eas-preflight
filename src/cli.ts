import { measureBundleSize } from './bundle-size.js';
import { compareToBaseRef } from './git-diff.js';
import { formatComment, postComment } from './github-comment.js';

export async function run(): Promise<void> {
  const projectDir = process.cwd();
  const baseRef = process.env.EAS_PREFLIGHT_BASE_REF ?? 'main';
  const maxIncreasePercent = parseThreshold(process.env.EAS_PREFLIGHT_MAX_INCREASE_PERCENT);
  const ignorePatterns = parseIgnorePatterns(process.env.EAS_PREFLIGHT_IGNORE_PATTERNS);

  const headSize = await measureBundleSize(projectDir, ignorePatterns);
  const comparison = await compareToBaseRef(projectDir, baseRef, headSize, ignorePatterns);
  const comment = formatComment(comparison, maxIncreasePercent);

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = Number(process.env.EAS_PREFLIGHT_PR_NUMBER);

  if (token && repo && Number.isFinite(prNumber)) {
    await postComment({ token, repo, prNumber }, comment);
  } else {
    console.log(comment);
  }

  if (maxIncreasePercent !== undefined && comparison.deltaPercent > maxIncreasePercent) {
    process.exitCode = 1;
  }
}

function parseThreshold(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`EAS_PREFLIGHT_MAX_INCREASE_PERCENT must be a number, got "${value}"`);
  }

  return parsed;
}

// Comma or newline separated so it reads naturally in a YAML workflow input.
function parseIgnorePatterns(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n,]/)
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
