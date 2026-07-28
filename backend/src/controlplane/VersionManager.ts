/**
 * Enumeration representing the result of comparing incoming versions to local versions.
 */
export enum VersionComparisonResult {
  STALE,         // Incoming version is old or duplicate
  INCREMENTAL,   // Incoming version matches localVersion + 1 (sequential)
  GAP_DETECTED   // Incoming version is ahead of localVersion + 1 (events missed)
}

/**
 * Control Plane Version Manager.
 * Tracks local configuration version numbers per cluster, providing helper routines
 * to detect configuration drifts or message gaps.
 */
export class VersionManager {
  private readonly localVersions: Map<string, number> = new Map();

  /**
   * Fetches the current local version number of a cluster. Defaults to 0 if not tracked.
   */
  public getVersion(clusterName: string): number {
    return this.localVersions.get(clusterName.toLowerCase()) || 0;
  }

  /**
   * Updates the local version number of a cluster.
   */
  public setVersion(clusterName: string, version: number): void {
    this.localVersions.set(clusterName.toLowerCase(), version);
  }

  /**
   * Compares an incoming config version with the current local version.
   */
  public compareVersion(clusterName: string, incomingVersion: number): VersionComparisonResult {
    const localVersion = this.getVersion(clusterName);

    if (incomingVersion <= localVersion) {
      return VersionComparisonResult.STALE;
    }

    if (incomingVersion === localVersion + 1) {
      return VersionComparisonResult.INCREMENTAL;
    }

    return VersionComparisonResult.GAP_DETECTED;
  }

  /**
   * Resets all version tracking.
   */
  public clear(): void {
    this.localVersions.clear();
  }
}
