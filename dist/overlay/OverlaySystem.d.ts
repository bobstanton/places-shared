import type { ZoomScaledNumber } from '../utils/ZoomScaledNumber';
export { parseZoomScaledNumber, type ZoomScaledNumber, type ZoomValueStop } from '../utils/ZoomScaledNumber';
import type * as GeoJSON from 'geojson';
import { PlacesBoundingBox } from '../geo/PlacesBoundingBox';
import type { ZoomRange } from '../ZoomVisibility';
import type { PopupContentConfig } from '../settings/PopupConfiguration';
export type { MapPlace } from '../Place';
export { parseMapPlaceProperty } from '../Place';
export type OverlayRenderBand = 'background' | 'default';
export declare const OVERLAY_RENDER_BAND_PROPERTY = "places_overlay_render_band";
interface RenderBandedOverlay {
    renderBand?: OverlayRenderBand;
}
export interface ImageOverlayBounds {
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
}
export interface ImageOverlayCorners {
    nwLat: number;
    nwLng: number;
    neLat: number;
    neLng: number;
    seLat: number;
    seLng: number;
    swLat: number;
    swLng: number;
}
export interface GeoJSONOverlay extends RenderBandedOverlay {
    type: 'geojson';
    geojson: GeoJSON.GeoJSON;
    source: string;
    zoom?: ZoomRange;
    labelTemplate?: string;
    waypointLabelTemplate?: string;
    popup?: PopupContentConfig;
    style?: OverlayRenderStyle;
    hoverStyle?: OverlayRenderStyle;
}
export interface ImageOverlayStyle {
    opacity?: number;
}
export interface ImageOverlay extends RenderBandedOverlay {
    type: 'image';
    url: string;
    bounds?: ImageOverlayBounds;
    corners?: ImageOverlayCorners;
    style?: ImageOverlayStyle;
    source: string;
    zoom?: ZoomRange;
}
export type VectorTileLayerType = 'line' | 'fill' | 'circle' | 'symbol';
export interface OverlayRenderStyle {
    color?: string;
    opacity?: ZoomScaledNumber;
    width?: ZoomScaledNumber;
    dashArray?: string;
    fillColor?: string;
    fillOpacity?: number;
    circleRadius?: number;
    strokeColor?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    textSize?: ZoomScaledNumber;
    textColor?: string;
    textHaloColor?: string;
    textHaloWidth?: number;
    iconSize?: number;
}
export declare function zoomScaledNumberToExpression(value: ZoomScaledNumber | undefined): number | unknown[] | undefined;
export declare function parseVectorTileDashArray(value: string | undefined): string | undefined;
export type VectorTileFilter = unknown[];
export interface VectorTileOverlay extends RenderBandedOverlay {
    type: 'vector-tile';
    source: string;
    url?: string;
    tiles?: string[];
    sourceLayer: string;
    layerType: VectorTileLayerType;
    zoom?: ZoomRange;
    bounds?: [number, number, number, number];
    attribution?: string;
    filter?: VectorTileFilter;
    textField?: string;
    symbolPlacement?: 'point' | 'line' | 'line-center';
    sprite?: string;
    icon?: string;
    style?: OverlayRenderStyle;
    hoverStyle?: OverlayRenderStyle;
    popup?: PopupContentConfig;
    hitLabel?: string;
    tileZoom?: ZoomRange;
    tileProvider?: string;
}
export interface VectorTileSourceDefinition {
    url?: string;
    tiles?: readonly string[];
    bounds?: readonly [number, number, number, number];
    attribution?: string;
    tileZoom?: ZoomRange;
}
export declare function getVectorTileOverlaySourceSignature(overlay: VectorTileSourceDefinition): string;
export declare function createVectorTileOverlaySourceId(overlay: VectorTileSourceDefinition): string;
export declare function parseVectorTileFilter(input: string): VectorTileFilter | undefined;
export type Overlay = GeoJSONOverlay | ImageOverlay | VectorTileOverlay;
export interface OverlayResult {
    overlays: Overlay[];
    errors: Array<{
        path: string;
        error: string;
    }>;
}
export declare function isGeoJSONOverlay(overlay: Overlay): overlay is GeoJSONOverlay;
export declare function isImageOverlay(overlay: Overlay): overlay is ImageOverlay;
export declare function isVectorTileOverlay(overlay: Overlay): overlay is VectorTileOverlay;
export declare function getGeoJsonFeatureRenderBand(feature: GeoJSON.Feature): OverlayRenderBand;
export declare function getGeoJsonRenderBand(geojson: GeoJSON.GeoJSON): OverlayRenderBand;
export declare function resolveOverlayRenderBand(overlay: Overlay): OverlayRenderBand;
export interface OverlayBoundsExtensionResult {
    overlays: readonly Overlay[];
}
export declare function extendBoundingBoxWithOverlays(boundingBox: PlacesBoundingBox, overlays: readonly Overlay[]): OverlayBoundsExtensionResult;
export declare function extractOverlayPointFeatures(overlays: readonly Overlay[]): GeoJSON.Feature[];
export declare function extractGeoJsonLineLatLngCoordinates(geojson: GeoJSON.GeoJSON): Array<[number, number]>;
export declare function getGeoJsonFeatures(geojson: GeoJSON.GeoJSON): GeoJSON.Feature[];
export interface TrackOverlayStyle {
    color?: string;
    fillColor?: string;
    weight?: number;
    opacity?: number;
    fillOpacity?: number;
    style?: 'solid' | 'dashed';
    dashArray?: string;
    outline?: boolean;
    outlineStyle?: 'solid' | 'dashed';
    outlineDashArray?: string;
    outlineColor?: string;
    outlineWeight?: number;
    outlineOpacity?: number;
    colorBy?: string;
    [key: string]: unknown;
}
