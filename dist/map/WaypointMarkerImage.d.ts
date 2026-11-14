export declare const WAYPOINT_MARKER_IMAGE_ID = "places-waypoint-marker";
export declare const WAYPOINT_MARKER_SDF_RADIUS_PX = 12;
interface WaypointMarkerImageTarget {
    hasImage(id: string): boolean;
    addImage(id: string, image: {
        width: number;
        height: number;
        data: Uint8Array | Uint8ClampedArray;
    }, options?: {
        sdf?: boolean;
        pixelRatio?: number;
    }): void;
}
export declare function ensureWaypointMarkerImage(map: WaypointMarkerImageTarget): string;
export {};
