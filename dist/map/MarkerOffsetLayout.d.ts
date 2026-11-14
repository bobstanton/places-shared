import type { ComputedIconStyle } from '../Place';
export interface MarkerOffsetLayout {
    id: string;
    iconOffset: [number, number];
    labelAnchorOffsets: Array<string | [number, number]>;
}
export declare function getMarkerOffsetLayout(style: ComputedIconStyle | undefined, fontSize?: number, mapAligned?: boolean): MarkerOffsetLayout;
export declare function buildMarkerOffsetExpressions(layouts: Iterable<MarkerOffsetLayout>): {
    iconOffset: unknown[];
    labelAnchorOffsets: unknown[];
};
