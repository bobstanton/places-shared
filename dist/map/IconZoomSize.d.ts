import type { ComputedIconStyle, IconZoomSizeStop } from '../Place';
export declare function iconZoomStopKey(zoom: number): string;
export declare function iconScaleAtZoom(stops: readonly IconZoomSizeStop[], zoom: number): number;
export declare function collectIconZoomSizeStops(styles: Array<ComputedIconStyle | undefined>): number[];
export declare function iconZoomScaleProperties(style: ComputedIconStyle | undefined, layerStops: readonly number[]): Record<string, number>;
export declare function buildIconSizeExpression(layerStops: readonly number[]): unknown[];
