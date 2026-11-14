export interface ClusteringDecisionInput {
  placeCount: number;
  overlayPointCount: number;
  clusterThreshold: number; //0 to disable
  clusterGeoJsonOverlays: boolean;
}

export interface ClusteringDecisionResult {
  shouldCluster: boolean;
  unifiedClusteringActive: boolean;
  totalPointCount: number;
}

// threshold <= 0 means clustering is off, not "always cluster".
export function shouldClusterCount(count: number, threshold: number): boolean {
  return threshold > 0 && count >= threshold;
}

// All providers must resolve clustering through this.
export function resolveClusteringDecision(input: ClusteringDecisionInput): ClusteringDecisionResult {
  const { placeCount, overlayPointCount, clusterThreshold, clusterGeoJsonOverlays } = input;

  const totalPointCount = placeCount + overlayPointCount;

  const shouldCluster = shouldClusterCount(totalPointCount, clusterThreshold);

  const unifiedClusteringActive = shouldCluster && clusterGeoJsonOverlays && overlayPointCount > 0;

  return {
    shouldCluster,
    unifiedClusteringActive,
    totalPointCount,
  };
}
