import type { BundleSizeResult } from './bundle-size.js';

export interface SizeComparison {
  baseBytes: number;
  headBytes: number;
  deltaBytes: number;
  deltaPercent: number;
}

export async function compareToBaseRef(
  baseRef: string,
  headSize: BundleSizeResult,
): Promise<SizeComparison> {
  throw new Error(
    `compareToBaseRef not yet implemented for ref "${baseRef}", head size ${headSize.totalBytes}`,
  );
}
