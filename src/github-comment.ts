import type { SizeComparison } from './git-diff.js';

export interface PostCommentOptions {
  token: string;
  repo: string;
  prNumber: number;
}

export function formatComment(comparison: SizeComparison): string {
  const sign = comparison.deltaBytes >= 0 ? '+' : '';
  return `App bundle size: ${sign}${comparison.deltaBytes} bytes (${sign}${comparison.deltaPercent.toFixed(1)}%)`;
}

export async function postComment(options: PostCommentOptions, body: string): Promise<void> {
  throw new Error(
    `postComment not yet implemented for PR #${options.prNumber} in ${options.repo}: ${body}`,
  );
}
