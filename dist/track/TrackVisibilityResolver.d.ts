import type * as GeoJSON from 'geojson';
import { MapPlace, MapPlaceOverlay, Waypoint } from '../Place';
import type { TrackColorBy } from './TrackRenderer';
import type { ResolvedMapConfig } from '../settings/MapConfiguration';
import type { MetricWindow } from '../settings/MetricWindow';
import { Overlay } from '../overlay/OverlaySystem';
import type { Coordinate } from '../geo/DistanceCalculator';
import type { Meters } from '../Units';
export interface CompleteTrackStyle {
    style: 'solid' | 'dashed';
    dashArray: number[];
    color: string;
    outlineColor: string;
    weight: number;
    outlineWeight: number;
    opacity: number;
    outlineOpacity: number;
    outlineStyle: 'solid' | 'dashed';
    outlineDashArray: number[];
}
export declare const TRACK_STYLE_DEFAULTS: CompleteTrackStyle;
export interface PartialTrackStyle {
    style?: 'solid' | 'dashed';
    dashArray?: number[] | string | number;
    color?: string;
    outlineColor?: string;
    weight?: number;
    outlineWeight?: number;
    opacity?: number;
    outlineOpacity?: number;
    outlineStyle?: 'solid' | 'dashed';
    outlineDashArray?: number[] | string | number;
}
export declare function parseDashArray(value: number[] | string | number): number[];
export declare function dashArrayToPixels(dashArray: readonly number[], weight: number): string;
export declare function parseTrackLineStyle(value?: string): Pick<CompleteTrackStyle, 'style' | 'dashArray'>;
export declare function mergeWithDefaults(partialStyle?: PartialTrackStyle): CompleteTrackStyle;
export declare function usesTrackGradient(coloringType?: TrackColorBy): boolean;
export declare function getTrackStyle(coloringType?: TrackColorBy): 'solid' | 'dashed';
export declare function resolveTrackAppearance(place: MapPlace, defaults?: {
    style?: 'solid' | 'dashed';
    outline?: boolean;
    colorBy?: TrackColorBy;
}): CompleteTrackStyle & {
    outline: boolean;
};
export declare function getPlaceId(place: MapPlace): string;
export declare function overlayShapeSignature(place: MapPlace): string;
export declare function getPlaceMarkerRenderSignature(place: MapPlace): string;
export declare function overlayGeometrySignature(geojson: GeoJSON.FeatureCollection): string;
export declare function overlayRenderSignature(overlay: MapPlaceOverlay): string;
export declare function getPlaceTrackRenderHash(place: MapPlace): string;
export declare function getTrackStateRenderSignature(state: PlaceTrackState): string;
export interface TrackVisibilityInput {
    places: MapPlace[];
    settings: ResolvedMapConfig;
    clusteringEnabled: boolean;
    overlays?: readonly Overlay[];
}
export interface PlaceTrackState {
    placeId: string;
    place: MapPlace;
    showOnLoad: boolean;
    style: 'solid' | 'dashed';
    outline: boolean;
    effectiveColorBy?: string;
    gradeWindow?: MetricWindow;
    speedWindow?: MetricWindow;
}
export interface TrackVisibilityResult {
    placeStates: PlaceTrackState[];
    placeStateMap: Map<string, PlaceTrackState>;
    hasAnyVisibleTracks: boolean;
    isSingleTrackView: boolean;
    shouldShowByDefault: boolean;
    defaultStyle: 'solid' | 'dashed';
    defaultOutline: boolean;
    blockOverlays: Overlay[];
}
export declare function resolveTrackVisibility(input: TrackVisibilityInput): TrackVisibilityResult;
export declare function getStyleForPlace(visibility: TrackVisibilityResult | undefined, placeId: string, place?: MapPlace): CompleteTrackStyle & {
    outline: boolean;
};
export interface ExtractedTrackGeometry {
    encodedPolyline: string;
    coordinates: Coordinate[];
    elevations?: Meters[];
    waypoints?: Waypoint[];
}
export declare function extractTrackGeometry(place: MapPlace): ExtractedTrackGeometry | null;
export interface SegmentOverlayOptions {
    coordinates: [number, number][];
    color: string;
    weight: number;
    opacity: number;
    style?: 'solid' | 'dashed';
    dashArray?: number[];
    name?: string;
    metadata?: Record<string, unknown>;
}
export declare function createSegmentOverlayPlace(options: SegmentOverlayOptions): MapPlace;
export declare function createBoundsAnchors(bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}): MapPlace[];
export declare function extractCoordinatesFromOverlay(overlay: MapPlaceOverlay): Coordinate[];
export declare function extractCoordinatesFromOverlayWork(overlay: MapPlaceOverlay): Generator<void, Coordinate[]>;
