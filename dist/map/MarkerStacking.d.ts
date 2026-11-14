import type { MapPlace } from '../Place';
export declare const PICTURE_MARKER_Z_INDEX = -1;
export declare function explicitMarkerZIndex(place: MapPlace): number | undefined;
export declare function markerStackingOrder(place: MapPlace): number;
