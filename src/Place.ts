import type { TrackColorBy } from './track/TrackRenderer';
import type * as GeoJSON from 'geojson';
import type { Meters } from './Units';
import type { ZoomRange } from './ZoomVisibility';
import { getMarkerIconGeometry } from './map/MarkerIconGeometry';

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
  // Per-point timestamps as epoch ms, aligned with concatenated line coordinates
  // (NaN for missing times). Elevations ride
  // in the LineString's Z coordinate; GeoJSON has no slot for time, and it
  // travels in the feature's `coordTimes` property.
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

  // True while `latitude`/`longitude` are placeholders awaiting `resolvePlace`
  // (Mapbox's suggest endpoint returns no coordinates; retrieve does). Such a
  // result must not be placed on a map until resolved.
  coordinatesPending?: boolean;

  resolvePlace?: () => Promise<Place>;
}

// A decorative glyph composited with the marker icon (iconStyles `content:` rules).
export interface IconBadgeOffset {
  value: number;
  unit: '%' | 'px';
}

export interface IconBadgeStyle {
  content: string;
  // Size relative to the icon, in percent (default 100).
  sizePct: number;
  opacity: number;
  order: 'behind' | 'front';
  // Badge-local offset. Percentages are relative to the badge glyph size.
  offsetX?: IconBadgeOffset;
  // Badge-local offset. Percentages are relative to the badge glyph size.
  offsetY?: IconBadgeOffset;
}

// One halo pass from an iconStyles `filter: drop-shadow(...)` or `text-shadow:` rule.
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
  radius: { value: number; unit: 'px' | '%' };
}

// One stop of a zoom-interpolated icon size rule (`font-size: 25% @z7, 87.5% @z15`).
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

// `iconStyles`/`labelStyles` can hide a marker two equivalent ways - `opacity: 0`
// or `display: none` - and both renderers must agree, per behavior contract #4.
export function isStyleHidden(style: { opacity?: number; inlineCss?: string } | undefined): boolean {
  if (!style) return false;

  return style.opacity === 0 || style.inlineCss?.toLowerCase().includes('display: none') === true;
}

export const DEFAULT_LABEL_FONT_SIZE_PX = 14;

export function getLabelOffsetEm(iconStyle: ComputedIconStyle | undefined, labelStyle: ComputedLabelStyle | undefined): number {
  const { left, right, top, bottom } = getMarkerIconGeometry(iconStyle);

  return Math.max(-left, right, -top, bottom) / (labelStyle?.fontSize ?? DEFAULT_LABEL_FONT_SIZE_PX);
}

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

// Callbacks travel on
// MapRuntimeContext.onPlaceAction; place data can cross GL serialization boundaries.
export interface PlaceAction {
  // Action id, unique within the place.
  id: string;
  // Button/checkbox label.
  label: string;
  // When set, the action renders as a checkbox with this state; otherwise as a button.
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

export function parseMapPlaceProperty(value: unknown): MapPlace | undefined {
  if (typeof value === 'string' && value) return JSON.parse(value) as MapPlace;

  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as MapPlace : undefined;
}

export function hasTrackData(place: MapPlace | undefined): boolean {
  return Boolean(place?.overlay && (place.overlay.track
    || place.overlay.geojson?.features?.some(feature => Boolean(feature.geometry))));
}
