export interface ClusteringDecisionInput {
    placeCount: number;
    overlayPointCount: number;
    clusterThreshold: number;
    clusterGeoJsonOverlays: boolean;
}
export interface ClusteringDecisionResult {
    shouldCluster: boolean;
    unifiedClusteringActive: boolean;
    totalPointCount: number;
}
export declare function shouldClusterCount(count: number, threshold: number): boolean;
export declare function resolveClusteringDecision(input: ClusteringDecisionInput): ClusteringDecisionResult;
