import { measureBundleSize } from './bundle-size.js';
import { compareToBaseRef } from './git-diff.js';
import { formatComment, postComment } from './github-comment.js';

export async function run(): Promise<void> {
  const projectDir = process.cwd();
  const baseRef = process.env.EAS_PREFLIGHT_BASE_REF ?? 'main';

  const headSize = await measureBundleSize(projectDir);
  const comparison = await compareToBaseRef(projectDir, baseRef, headSize);
  const comment = formatComment(comparison);

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = Number(process.env.EAS_PREFLIGHT_PR_NUMBER);

  if (token && repo && Number.isFinite(prNumber)) {
    await postComment({ token, repo, prNumber }, comment);
  } else {
    console.log(comment);
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
