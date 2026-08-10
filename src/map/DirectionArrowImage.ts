export const TRACK_DIRECTION_ARROW_IMAGE_ID = 'places-track-direction-arrow';

// Register a filled SDF chevron for line-direction symbol layers.
export function ensureTrackDirectionArrowImage(map: {
  hasImage(id: string): boolean;
  addImage(id: string, image: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }, options?: { sdf?: boolean; pixelRatio?: number }): void;
}): string {
  if (map.hasImage(TRACK_DIRECTION_ARROW_IMAGE_ID)) return TRACK_DIRECTION_ARROW_IMAGE_ID;

  // The 48px grid is the SDF source resolution; a distance field reconstructs
  // crisp edges at any render scale.
  const width = 48;
  const height = 48;
  const data = new Uint8Array(width * height * 4);
  // A filled arrow: a shaft plus a triangular head, pointing along the line.
  // Symmetric about the icon centre, its tip landing on the line under
  // icon-anchor 'center'.
  const polygon = [[4, 20], [30, 20], [30, 11], [46, 24], [30, 37], [30, 28], [4, 28]] as const;
  const spread = 24;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let edgeDistance = Number.POSITIVE_INFINITY;
      for (let edge = 0; edge < polygon.length; edge++) {
        const [x1, y1] = polygon[edge];
        const [x2, y2] = polygon[(edge + 1) % polygon.length];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / lengthSquared));
        edgeDistance = Math.min(edgeDistance, Math.hypot(x + 0.5 - (x1 + t * dx), y + 0.5 - (y1 + t * dy)));
      }
      let inside = false;
      for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
        const [cx, cy] = polygon[current];
        const [px, py] = polygon[previous];
        if ((cy > y + 0.5) !== (py > y + 0.5)
          && x + 0.5 < (px - cx) * (y + 0.5 - cy) / (py - cy) + cx) inside = !inside;
      }
      const alpha = Math.max(0, Math.min(255, Math.round(128 + (inside ? edgeDistance : -edgeDistance) * spread)));
      const offset = (y * width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = alpha;
    }
  }
  // pixelRatio 1 maps icon-size 1:1 to the 48px art (pixelRatio 2 would halve it).
  map.addImage(TRACK_DIRECTION_ARROW_IMAGE_ID, { width, height, data }, { sdf: true, pixelRatio: 1 });
  return TRACK_DIRECTION_ARROW_IMAGE_ID;
}
