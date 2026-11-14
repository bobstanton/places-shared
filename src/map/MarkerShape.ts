import type { IconShapeStyle } from '../Place';

export const GLYPH_EM_RATIO = 0.82;

export const SHAPE_BOX_SCALE = GLYPH_EM_RATIO / (20 / 36);

export interface MarkerShapeBox {
  centerX: number;
  centerY: number;
  size: number;
}

export function getMarkerShapeSize(iconBoxPx: number): number {
  return iconBoxPx * SHAPE_BOX_SCALE;
}

export function resolveMarkerShapeRadius(shape: IconShapeStyle, size: number): number {
  const radius = shape.radius.unit === '%' ? size * shape.radius.value / 100 : shape.radius.value;

  return Math.max(0, Math.min(radius, size / 2));
}

interface ShapeContext {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
}

function traceRoundedRect(context: ShapeContext, left: number, top: number, size: number, radius: number): void {
  const right = left + size;
  const bottom = top + size;

  context.beginPath();
  context.moveTo(left + radius, top);
  context.arcTo(right, top, right, bottom, radius);
  context.arcTo(right, bottom, left, bottom, radius);
  context.arcTo(left, bottom, left, top, radius);
  context.arcTo(left, top, right, top, radius);
  context.closePath();
}

export function drawMarkerShape(context: ShapeContext, shape: IconShapeStyle, box: MarkerShapeBox, pixelRatio: number): void {
  const strokeWidth = shape.stroke ? shape.strokeWidth * pixelRatio : 0;
  const size = Math.max(0, box.size - strokeWidth);

  if (size <= 0) return;

  const left = box.centerX - size / 2;
  const top = box.centerY - size / 2;

  traceRoundedRect(context, left, top, size, resolveMarkerShapeRadius(shape, size));

  if (shape.fill) {
    context.fillStyle = shape.fill;
    context.fill();
  }

  if (shape.stroke && strokeWidth > 0) {
    context.strokeStyle = shape.stroke;
    context.lineWidth = strokeWidth;
    context.stroke();
  }
}
