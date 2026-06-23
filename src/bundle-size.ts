export interface BundleSizeResult {
  totalBytes: number;
}

export async function measureBundleSize(projectDir: string): Promise<BundleSizeResult> {
  throw new Error(`measureBundleSize not yet implemented for ${projectDir}`);
}
