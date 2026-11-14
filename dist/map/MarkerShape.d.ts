import type { IconShapeStyle } from '../Place';
export declare const GLYPH_EM_RATIO = 0.82;
export declare const SHAPE_BOX_SCALE: number;
export interface MarkerShapeBox {
    centerX: number;
    centerY: number;
    size: number;
}
export declare function getMarkerShapeSize(iconBoxPx: number): number;
export declare function resolveMarkerShapeRadius(shape: IconShapeStyle, size: number): number;
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
export declare function drawMarkerShape(context: ShapeContext, shape: IconShapeStyle, box: MarkerShapeBox, pixelRatio: number): void;
export {};
