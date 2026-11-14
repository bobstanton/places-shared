import type { ComputedIconStyle } from '../Place';
export declare const MARKER_ICON_SIZE_PX = 28;
export declare function getMaxIconScale(style: ComputedIconStyle | undefined): number;
export declare function getMarkerIconGeometry(style: ComputedIconStyle | undefined): {
    imageScale: number;
    badgeOffsetX: number;
    badgeOffsetY: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
};
export declare function getMarkerLabelAnchorOffsets(style: ComputedIconStyle | undefined, fontSize?: number, mapAligned?: boolean): Array<string | [number, number]>;
