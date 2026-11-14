import type { ImageOverlayAlignmentCorner, ImageOverlayAlignmentCorners } from './ImageOverlayAlignment';
export type PixelPoint = [number, number];
export interface AlignmentPointPair {
    pixel: PixelPoint;
    latlng: [number, number];
    enabled?: boolean;
}
export interface ControlPointAlignment {
    fit: 'similarity' | 'affine';
    points: AlignmentPointPair[];
    imageSize?: PixelPoint;
}
export type AlignmentStatus = 'Not fitted' | 'Fit up to date' | 'Points changed — fit again' | 'Manually adjusted';
export interface AlignmentSnapshot {
    corners: ImageOverlayAlignmentCorners;
    alignment: ControlPointAlignment;
    status: AlignmentStatus;
}
export declare function cloneAlignment<T>(value: T): T;
export declare class AlignmentHistory {
    private entries;
    private index;
    constructor(initial: AlignmentSnapshot);
    get canUndo(): boolean;
    get canRedo(): boolean;
    commit(state: AlignmentSnapshot): void;
    undo(): AlignmentSnapshot;
    redo(): AlignmentSnapshot;
}
export declare function parseControlPointAlignment(value: unknown): ControlPointAlignment;
export declare function projectAlignmentPoint(latlng: [number, number], originLng?: number): PixelPoint;
export declare function unprojectAlignmentPoint([x, y]: PixelPoint): ImageOverlayAlignmentCorner;
export interface ControlPointFit {
    corners: ImageOverlayAlignmentCorners;
    errors: (number | null)[];
    warning?: string;
}
export declare function fitAlignmentPoints(alignment: ControlPointAlignment, width: number, height: number): ControlPointFit;
export declare function snapAlignmentPoint(point: ImageOverlayAlignmentCorner, lines: readonly (readonly [number, number][])[], map: {
    project(p: ImageOverlayAlignmentCorner): {
        x: number;
        y: number;
    };
    unproject(p: PixelPoint): ImageOverlayAlignmentCorner;
}, threshold?: number): ImageOverlayAlignmentCorner | undefined;
