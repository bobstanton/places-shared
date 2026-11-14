export const WAYPOINT_MARKER_IMAGE_ID = 'places-waypoint-marker';
export const WAYPOINT_MARKER_SDF_RADIUS_PX = 12;

interface WaypointMarkerImageTarget {
  hasImage(id: string): boolean;
  addImage(id: string, image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }, options?: { sdf?: boolean; pixelRatio?: number }): void;
}

export function ensureWaypointMarkerImage(map: WaypointMarkerImageTarget): string {
  if (map.hasImage(WAYPOINT_MARKER_IMAGE_ID)) return WAYPOINT_MARKER_IMAGE_ID;

  const width = 40;
  const height = 40;
  const centerX = width / 2;
  const centerY = height / 2;
  const spread = 8;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distanceFromEdge = WAYPOINT_MARKER_SDF_RADIUS_PX
        - Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
      const alpha = Math.max(0, Math.min(255, Math.round(128 + distanceFromEdge * spread)));
      const offset = (y * width + x) * 4;

      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alpha;
    }
  }

  map.addImage(WAYPOINT_MARKER_IMAGE_ID, { width, height, data }, { sdf: true, pixelRatio: 1 });

  return WAYPOINT_MARKER_IMAGE_ID;
}
