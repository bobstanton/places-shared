import type { TrackColorBy } from './track/TrackRenderer';
import type * as GeoJSON from 'geojson';
import type { Meters } from './Units';
import type { ZoomRange } from './ZoomVisibility';

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
  // Per-point timestamps as epoch ms, parallel to `elevation`. Elevations ride
  // in the LineString's Z coordinate; GeoJSON has no slot for time, and it
  // travels in the feature's `coordTimes` property.
  time?: number[];
  waypoints?: Waypoint[];
}

import { TrackOverlayStyle } from './overlay/OverlaySystem';

export interface MapPlaceOverlay {
  geojson: GeoJSON.FeatureCollection;
  track?: OverlayTrackData;
  style?: TrackOverlayStyle;
  // Start/midpoint/end path-label point features, kept out of `geojson`: bounds, visibility,
  // hasTrackData, and clustering read the track geometry without label points. Merged into
  // the overlay source only at render time.
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

// One stop of a zoom-interpolated icon size rule (`font-size: 25% @z7, 87.5% @z15`).
export interface IconZoomSizeStop {
  zoom: number;
  scale: number;
}

export interface ComputedIconStyle {
  opacity?: number;
  zIndex?: number;
  zoom?: ZoomRange;
  // Base icon scale from a plain `font-size: N%` rule (also kept in inlineCss for HTML markers).
  scale?: number;
  // Glyph colour from a `color:` rule (also kept in inlineCss for HTML markers).
  // Only affects text-presentation glyphs - arrows, geometric shapes, dingbats.
  // Colour emoji are bitmap glyphs and ignore it in both renderers.
  color?: string;
  badge?: IconBadgeStyle;
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

// The symbol renderer rasterizes the style image at this scale, and GL only ever downscales -
// upscaling a raster is what makes enlarged emoji blurry.
export function getMaxIconScale(style: ComputedIconStyle | undefined): number {
  const base = style?.scale ?? 1;
  const maxStop = (style?.zoomSizeStops ?? []).reduce((max, stop) => Math.max(max, stop.scale), 1);
  return Math.max(1, base * maxStop);
}

// Default native label text size; 1em of it equals half the 28px marker icon: a 1em offset clears an unscaled icon.
export const DEFAULT_LABEL_FONT_SIZE_PX = 14;

// Label radial offset (in ems of the label's own text size) that clears the icon and any
// badge overhang at the icon's largest rendered scale.
export function getLabelOffsetEm(iconStyle: ComputedIconStyle | undefined, labelStyle: ComputedLabelStyle | undefined): number {
  const badge = iconStyle?.badge;
  const badgeScale = (badge?.sizePct ?? 100) / 100;
  const offsetOverhang = badge
    ? Math.max(Math.abs(getBadgeOffsetScale(badge.offsetX, badgeScale)), Math.abs(getBadgeOffsetScale(badge.offsetY, badgeScale)))
    : 0;
  const badgeOverhang = Math.max(1, badgeScale + offsetOverhang);
  const clearanceScale = getMaxIconScale(iconStyle) * badgeOverhang;
  return clearanceScale * DEFAULT_LABEL_FONT_SIZE_PX / (labelStyle?.fontSize ?? DEFAULT_LABEL_FONT_SIZE_PX);
}

function getBadgeOffsetScale(offset: IconBadgeOffset | undefined, badgeScale: number): number {
  if (!offset) return 0;
  return offset.unit === '%' ? badgeScale * offset.value / 100 : offset.value / DEFAULT_LABEL_FONT_SIZE_PX;
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

// A declarative popup action for a place. Data only - the callback travels on
// MapRuntimeContext.onPlaceAction because places are serialized into GL
// sources and Leaflet feature properties. See docs/per-place-interactions.md.
export interface PlaceAction {
  // Action id, unique within the place.
  id: string;
  // Button/checkbox label.
  label: string;
  // When set, the action renders as a checkbox with this state; otherwise as a button.
  checked?: boolean;
}

export interface MapPlace {
  // Id for interaction routing. Blocks that use actions must set it.
  id?: string;
  latitude: number;
  longitude: number;
  name: string;
  // Detail line shown under the name in the marker popup (type, distance, ...).
  subtitle?: string;
  originalName?: string;  // Name before label template processing.
  icon: string;
  filePath?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  // Complete normalized VaultQuery row, retained for per-place templates.
  queryRow?: Record<string, unknown>;

  overlay?: MapPlaceOverlay;
  // Per-note override of the block's `track.defaultVisibility`, same
  // `visible`/`hidden` vocabulary. Set from the `trackDefaultVisibility` note
  // property (the flattened internal name, shared with the resolved config).
  trackDefaultVisibility?: 'visible' | 'hidden';
  trackColorBy?: TrackColorBy;

  trackColor?: string;
  trackWeight?: number;
  trackOpacity?: number;
  trackStyle?: string;
  trackDashArray?: string;
  trackOutline?: boolean;
  trackOutlineColor?: string;
  trackOutlineWeight?: number;
  trackOutlineOpacity?: number;
  markerZoom?: ZoomRange;
  labelZoom?: ZoomRange;
  trackZoom?: ZoomRange;

  // Marker rotation in degrees clockwise from true north, resolved per place
  // from the block's `iconRotation`. ComputedIconStyle is rebuilt wholesale by
  // MarkerStyleService; a field there would be overwritten.
  iconRotation?: number;
  iconStyle?: ComputedIconStyle;
  labelStyle?: ComputedLabelStyle;
  dataAttributes?: Record<string, string>;

  actions?: PlaceAction[];
}

// Deserialize the MapPlace stored on a GeoJSON feature's `mapPlace` property. The full place is
// serialized to JSON because MapLibre rejects non-primitive feature values. Returns undefined when
// the property is absent or not a string; throws on malformed JSON, leaving recovery to the caller.
export function parseMapPlaceProperty(value: unknown): MapPlace | undefined {
  return typeof value === 'string' && value ? JSON.parse(value) as MapPlace : undefined;
}

export function hasTrackData(place: MapPlace | undefined): boolean {
  if (!place) return false;
  if (!place.overlay) return false;
  if (place.overlay.track) return true;
  return hasLineGeometry(place.overlay.geojson);
}

function hasLineGeometry(geojson: GeoJSON.FeatureCollection | undefined): boolean {
  if (!geojson?.features) return false;
  return geojson.features.some((feature) => {
    const type = feature.geometry?.type;
    return type === 'LineString' || type === 'MultiLineString';
  });
}
