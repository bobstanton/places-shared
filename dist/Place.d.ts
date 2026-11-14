import type { TrackColorBy } from './track/TrackRenderer';
import type * as GeoJSON from 'geojson';
import type { Meters } from './Units';
import type { ZoomRange } from './ZoomVisibility';
export { getMaxIconScale } from './map/MarkerIconGeometry';
export interface Waypoint {
    name: string;
    lat: number;
    lon: number;
    description?: string;
    symbol?: string;
    iconUrl?: string;
    type?: string;
    elevation?: Meters;
    time?: Date;
    comment?: string;
    link?: string;
}
export interface OverlayTrackData {
    elevation?: Meters[];
    time?: number[];
    waypoints?: Waypoint[];
}
import { TrackOverlayStyle } from './overlay/OverlaySystem';
export interface MapPlaceOverlay {
    geojson: GeoJSON.FeatureCollection;
    track?: OverlayTrackData | null;
    style?: TrackOverlayStyle;
    pathLabels?: GeoJSON.Feature[];
}
export type Place = {
    name: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    address: string;
    latitude: number;
    longitude: number;
    website: string;
    tags: string[];
    source: string;
    attribution: string;
    coordinatesPending?: boolean;
    resolvePlace?: () => Promise<Place>;
};
export interface IconBadgeOffset {
    value: number;
    unit: '%' | 'px';
}
export interface IconBadgeStyle {
    content: string;
    sizePct: number;
    opacity: number;
    order: 'behind' | 'front';
    offsetX?: IconBadgeOffset;
    offsetY?: IconBadgeOffset;
}
export interface IconShadowStyle {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
}
export interface IconShapeStyle {
    fill?: string;
    stroke?: string;
    strokeWidth: number;
    radius: {
        value: number;
        unit: 'px' | '%';
    };
}
export interface IconZoomSizeStop {
    zoom: number;
    scale: number;
}
export interface ComputedIconStyle {
    opacity?: number;
    zIndex?: number;
    zoom?: ZoomRange;
    scale?: number;
    color?: string;
    badge?: IconBadgeStyle;
    shape?: IconShapeStyle;
    shadows?: IconShadowStyle[];
    zoomSizeStops?: IconZoomSizeStop[];
    inlineCss: string;
    classes: string[];
}
export declare function isStyleHidden(style: {
    opacity?: number;
    inlineCss?: string;
} | undefined): boolean;
export declare const DEFAULT_LABEL_FONT_SIZE_PX = 14;
export declare function getLabelOffsetEm(iconStyle: ComputedIconStyle | undefined, labelStyle: ComputedLabelStyle | undefined): number;
export interface ComputedLabelStyle {
    color?: string;
    fontSize?: number;
    opacity?: number;
    haloColor?: string;
    haloWidth?: number;
    haloBlur?: number;
    letterSpacing?: number;
    maxWidth?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    textJustify?: 'left' | 'center' | 'right';
    zIndex?: number;
    zoom?: ZoomRange;
    hasUserStyle?: boolean;
    inlineCss: string;
    classes: string[];
}
export interface PlaceAction {
    id: string;
    label: string;
    checked?: boolean;
}
export interface MapPlace {
    settings?: import('./settings/MapConfiguration').MapConfigPatch;
    settingsLayers?: readonly import('./settings/PlaceSettings').PlaceSettingsLayer[];
    id?: string;
    latitude: number;
    longitude: number;
    name: string;
    subtitle?: string;
    originalName?: string;
    icon: string;
    iconImage?: string;
    iconImageStyle?: ComputedIconStyle;
    iconImageUrl?: string;
    markerEnabled?: boolean;
    filePath?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    queryRow?: Record<string, unknown>;
    overlay?: MapPlaceOverlay;
    trackDefaultVisibility?: 'visible' | 'hidden';
    trackColorBy?: TrackColorBy;
    trackColor?: string;
    trackWeight?: number;
    trackOpacity?: number;
    trackStyle?: string;
    trackDashArray?: string;
    trackOutline?: boolean;
    trackOutlineStyle?: 'solid' | 'dashed';
    trackOutlineColor?: string;
    trackOutlineWeight?: number;
    trackOutlineOpacity?: number;
    markerZoom?: ZoomRange;
    labelZoom?: ZoomRange;
    trackZoom?: ZoomRange;
    overlayZoom?: ZoomRange;
    iconRotation?: number;
    iconStyle?: ComputedIconStyle;
    labelStyle?: ComputedLabelStyle;
    dataAttributes?: Record<string, string>;
    actions?: PlaceAction[];
}
export declare function parseMapPlaceProperty(value: unknown): MapPlace | undefined;
export declare function hasTrackData(place: MapPlace | undefined): boolean;
