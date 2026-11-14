import type { ComputedIconStyle, IconBadgeOffset } from '../Place';
import { getMarkerShapeSize } from './MarkerShape';

export const MARKER_ICON_SIZE_PX = 28;

export function getMaxIconScale(style: ComputedIconStyle | undefined): number {
  const base = style?.scale ?? 1;
  const maxStop = (style?.zoomSizeStops ?? []).reduce((max, stop) => Math.max(max, stop.scale), 1);

  return Math.max(1, base * maxStop);
}

function badgeOffsetPx(offset: IconBadgeOffset | undefined, badgeFontPx: number): number {
  if (!offset) return 0;

  return offset.unit === '%' ? badgeFontPx * offset.value / 100 : offset.value;
}

export function getMarkerIconGeometry(style: ComputedIconStyle | undefined) {
  const badge = style?.badge;
  const imageScale = getMaxIconScale(style);
  const radius = MARKER_ICON_SIZE_PX * imageScale / 2;
  let left = -radius;
  let right = radius;
  let top = -radius;
  let bottom = radius;

  for (const shadow of style?.shadows ?? []) {
    left = Math.min(left, -radius + shadow.offsetX - shadow.blur);
    right = Math.max(right, radius + shadow.offsetX + shadow.blur);
    top = Math.min(top, -radius + shadow.offsetY - shadow.blur);
    bottom = Math.max(bottom, radius + shadow.offsetY + shadow.blur);
  }

  if (style?.shape) {
    const shapeRadius = getMarkerShapeSize(MARKER_ICON_SIZE_PX * imageScale) / 2;

    left = Math.min(left, -shapeRadius);
    right = Math.max(right, shapeRadius);
    top = Math.min(top, -shapeRadius);
    bottom = Math.max(bottom, shapeRadius);
  }

  const badgeFontPx = badge ? MARKER_ICON_SIZE_PX * imageScale * badge.sizePct / 100 : 0;
  const badgeOffsetX = badgeOffsetPx(badge?.offsetX, badgeFontPx);
  const badgeOffsetY = badgeOffsetPx(badge?.offsetY, badgeFontPx);

  if (badge && badge.opacity > 0) {
    left = Math.min(left, badgeOffsetX - badgeFontPx / 2);
    right = Math.max(right, badgeOffsetX + badgeFontPx / 2);
    top = Math.min(top, badgeOffsetY - badgeFontPx / 2);
    bottom = Math.max(bottom, badgeOffsetY + badgeFontPx / 2);
  }

  left = Math.floor(left);
  right = Math.ceil(right);
  top = Math.floor(top);
  bottom = Math.ceil(bottom);

  return {
    imageScale, badgeOffsetX, badgeOffsetY, left, right, top, bottom,
    width: right - left, height: bottom - top,
    offsetX: (left + right) / 2, offsetY: (top + bottom) / 2,
  };
}

export function getMarkerLabelAnchorOffsets(style: ComputedIconStyle | undefined, fontSize = 14, mapAligned = false): Array<string | [number, number]> {
  let { left, right, top, bottom } = getMarkerIconGeometry(style);

  if (mapAligned) {
    const radius = Math.hypot(Math.max(-left, right), Math.max(-top, bottom));

    left = top = -radius;
    right = bottom = radius;
  }

  const xLeft = (left - 6) / fontSize;
  const xRight = (right + 6) / fontSize;
  const baselineOffsetEm = 7 / 24;
  const yTop = (top - 6) / fontSize - baselineOffsetEm;
  const yBottom = (bottom + 6) / fontSize + baselineOffsetEm;

  return [
    'left', [xRight, 0],
    'right', [xLeft, 0],
    'bottom', [0, yTop],
    'top', [0, yBottom],
    'top-left', [xRight, baselineOffsetEm],
    'top-right', [xLeft, baselineOffsetEm],
    'bottom-left', [xRight, -baselineOffsetEm],
    'bottom-right', [xLeft, -baselineOffsetEm],
  ];
}
