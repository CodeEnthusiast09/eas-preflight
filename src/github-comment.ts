import { getOctokit } from '@actions/github';
import type { SizeComparison } from './git-diff.js';

// Hidden in the rendered comment; used to find and update our own comment on
// later pushes instead of posting a new one each time (avoids PR spam).
const COMMENT_MARKER = '<!-- eas-preflight -->';

export interface PostCommentOptions {
  token: string;
  repo: string;
  prNumber: number;
}

export function formatComment(comparison: SizeComparison): string {
  const sign = comparison.deltaBytes >= 0 ? '+' : '';

  return [
    COMMENT_MARKER,
    '### App size check',
    '',
    `**${sign}${comparison.deltaBytes} bytes (${sign}${comparison.deltaPercent.toFixed(1)}%)**`,
    '',
    `Base: ${comparison.baseBytes} bytes`,
    `Head: ${comparison.headBytes} bytes`,
  ].join('\n');
}

export async function postComment(options: PostCommentOptions, body: string): Promise<void> {
  const [owner, repo] = options.repo.split('/');

  if (!owner || !repo) {
    throw new Error(`Expected repo in "owner/repo" form, got "${options.repo}"`);
  }

  const octokit = getOctokit(options.token);

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: options.prNumber,
  });

  const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: options.prNumber,
      body,
    });
  }
}
