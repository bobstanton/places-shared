import { finishWork } from '../utils/CooperativeWork';
import { resolveOverlayTrackData } from './GeoJsonTrackData';
import type * as GeoJSON from 'geojson';
import { MapPlace, MapPlaceOverlay, OverlayTrackData, hasTrackData, Waypoint } from '../Place';
import type { TrackColorBy } from './TrackRenderer';
import type { ResolvedMapConfig } from '../settings/MapConfiguration';
import type { MetricWindow } from '../settings/MetricWindow';
import { Overlay } from '../overlay/OverlaySystem';
import { PolylineCodec } from './PolylineCodec';
import { stableSignature, stableSignatureCached } from '../utils/StableSignature';
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

export const TRACK_STYLE_DEFAULTS: CompleteTrackStyle = {
  style: 'dashed',
  dashArray: [2.5, 2.5], 
  color: '#F1175D',
  outlineColor: '#333333',
  weight: 4,
  outlineWeight: 5,
  opacity: 0.9,
  outlineOpacity: 1,
  outlineStyle: 'dashed',
  outlineDashArray: [2.5, 2.5],
} as const;

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

export function parseDashArray(value: number[] | string | number): number[] {
  const tokens = typeof value === 'string'
    ? (value.trim() ? value.trim().split(/[,\s]+/) : [])
    : typeof value === 'number' ? [value, value] : value;
  const numbers = tokens.map(Number);

  if (numbers.some(n => !Number.isFinite(n) || n < 0)) {
    throw new Error('dashArray must contain non-negative numbers separated by commas or spaces.');
  }

  return numbers.some(n => n > 0) ? numbers : [];
}

export function dashArrayToPixels(dashArray: readonly number[], weight: number): string {
  return dashArray.map(n => n * weight).join(', ');
}

export function parseTrackLineStyle(value?: string): Pick<CompleteTrackStyle, 'style' | 'dashArray'> {
  const normalized = value?.trim().toLowerCase();
  const dashArray = !normalized || normalized === 'solid' ? []
    : normalized === 'dashed' ? [...TRACK_STYLE_DEFAULTS.dashArray] : parseDashArray(normalized);

  return { style: dashArray.length ? 'dashed' : 'solid', dashArray };
}

export function mergeWithDefaults(partialStyle: PartialTrackStyle = {}): CompleteTrackStyle {
  const requestedStyle = partialStyle.style ?? TRACK_STYLE_DEFAULTS.style;
  const dashArray = partialStyle.style === 'solid' ? []
    : partialStyle.dashArray != null ? parseDashArray(partialStyle.dashArray)
    : requestedStyle === 'dashed' ? [...TRACK_STYLE_DEFAULTS.dashArray] : [];
  const outlineDashArray = partialStyle.outlineStyle === 'solid' ? []
    : partialStyle.outlineDashArray != null ? parseDashArray(partialStyle.outlineDashArray)
    : partialStyle.outlineStyle === 'dashed' ? [...TRACK_STYLE_DEFAULTS.dashArray] : [...dashArray];

  return {
    style: dashArray.length ? 'dashed' : 'solid',
    dashArray,
    outlineStyle: outlineDashArray.length ? 'dashed' : 'solid',
    outlineDashArray,
    color: partialStyle.color ?? TRACK_STYLE_DEFAULTS.color,
    outlineColor: partialStyle.outlineColor ?? TRACK_STYLE_DEFAULTS.outlineColor,
    weight: partialStyle.weight ?? TRACK_STYLE_DEFAULTS.weight,
    outlineWeight: partialStyle.outlineWeight ?? TRACK_STYLE_DEFAULTS.outlineWeight,
    opacity: partialStyle.opacity ?? TRACK_STYLE_DEFAULTS.opacity,
    outlineOpacity: partialStyle.outlineOpacity ?? TRACK_STYLE_DEFAULTS.outlineOpacity,
  };
}

export function usesTrackGradient(coloringType?: TrackColorBy): boolean {
  return coloringType !== undefined && coloringType !== 'none';
}

export function getTrackStyle(coloringType?: TrackColorBy): 'solid' | 'dashed' {
  return usesTrackGradient(coloringType) ? 'solid' : 'dashed';
}

export function resolveTrackAppearance(place: MapPlace, defaults: {
  style?: 'solid' | 'dashed'; outline?: boolean; colorBy?: TrackColorBy;
} = {}): CompleteTrackStyle & { outline: boolean } {
  const overlay = place.overlay?.style;
  const colorBy = place.trackColorBy ?? defaults.colorBy;
  const explicitStyle = place.trackStyle === 'solid' || place.trackStyle === 'dashed' ? place.trackStyle : overlay?.style;
  const properties = place.overlay?.geojson.features.find(feature =>
    feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString')?.properties;
  const featureDash: unknown = properties?.['stroke-dasharray'];
  const weight = place.trackWeight ?? overlay?.weight ?? TRACK_STYLE_DEFAULTS.weight;
  const featureWeight = typeof properties?.['stroke-width'] === 'number' && properties['stroke-width'] > 0 ? properties['stroke-width'] : weight;
  const dashArray = place.trackDashArray !== undefined
    ? parseDashArray(place.trackDashArray).map(n => n / weight) : place.trackStyle !== undefined ? undefined : overlay?.dashArray
    ?? (explicitStyle === undefined && (typeof featureDash === 'string' || Array.isArray(featureDash))
      ? parseDashArray(featureDash).map(n => n / featureWeight) : undefined);
  const style = explicitStyle ?? (dashArray !== undefined ? undefined
    : place.trackColorBy !== undefined ? getTrackStyle(colorBy) : defaults.style ?? getTrackStyle(colorBy));

  return {
    ...mergeWithDefaults({
      style: place.trackDashArray !== undefined ? undefined : style,
      dashArray,
      color: place.trackColor ?? overlay?.color,
      weight,
      opacity: place.trackOpacity ?? overlay?.opacity,
      outlineStyle: place.trackOutlineStyle ?? overlay?.outlineStyle,
      outlineDashArray: overlay?.outlineDashArray,
      outlineColor: place.trackOutlineColor ?? overlay?.outlineColor,
      outlineWeight: place.trackOutlineWeight ?? overlay?.outlineWeight,
      outlineOpacity: place.trackOutlineOpacity ?? overlay?.outlineOpacity,
    }),
    outline: place.trackOutline ?? overlay?.outline ?? defaults.outline ?? usesTrackGradient(colorBy),
  };
}

function getRenderSignature(value: unknown): string {
  return stableSignature(value);
}

export function getPlaceId(place: MapPlace): string {
  if (place.id) {
    return "id:" + place.id;
  }

  if (place.filePath) {
    return "file:" + place.filePath;
  }

  return "coord:" + place.latitude + "-" + place.longitude;
}

// Cheap geometry fingerprint: feature/coordinate counts plus first/last
// endpoints. Markers do not render track geometry (the note-track renderable
// does, with a full content hash), and the marker signature only needs enough
// shape to notice an overlay swap without serializing thousands of points.
export function overlayShapeSignature(place: MapPlace): string {
  const features = place.overlay?.geojson?.features;

  if (!features || features.length === 0) return '';
  let coordCount = 0;
  let endpoints = '';

  for (const feature of features) {
    const geometry = feature.geometry as GeoJSON.Geometry | undefined;

    if (geometry && 'coordinates' in geometry && Array.isArray(geometry.coordinates)) {
      const flat = geometry.coordinates as unknown[];

      coordCount += flat.length;

      if (!endpoints && flat.length > 0) {
        endpoints = JSON.stringify(flat[0]) + JSON.stringify(flat[flat.length - 1]);
      }
    }
  }

  return `${features.length}:${coordCount}:${endpoints}`;
}

const markerSignatures = new WeakMap<MapPlace, string>();

export function getPlaceMarkerRenderSignature(place: MapPlace): string {
  const cached = markerSignatures.get(place);

  if (cached !== undefined) return cached;
  const markerProps = {
    latitude: place.latitude,
    longitude: place.longitude,
    icon: place.icon,
    iconImageUrl: place.iconImageUrl,
    iconImageStyle: place.iconImageStyle,
    name: place.name,
    markerEnabled: place.markerEnabled,
    originalName: place.originalName,
    filePath: place.filePath,
    tags: place.tags,
    iconStyle: place.iconStyle,
    labelStyle: place.labelStyle,
    iconRotation: place.iconRotation,
    dataAttributes: place.dataAttributes,
    metadata: place.metadata ? stableSignatureCached(place.metadata) : '',
    settings: place.settings ? stableSignatureCached(place.settings) : '',
    trackDefaultVisibility: place.trackDefaultVisibility,
    overlayShape: overlayShapeSignature(place),
  };
  const signature = getRenderSignature(markerProps);

  markerSignatures.set(place, signature);

  return signature;
}

const float = new Float64Array(1);
const floatWords = new Uint32Array(float.buffer);
const { imul } = Math;

const numericSignatures = new WeakMap<object, string>();

function hashNumbers(hash: number, value: unknown): number {
  if (Array.isArray(value)) {
    hash = imul(hash ^ value.length, 0x01000193);

    for (const item of value) {
      if (typeof item === 'number') {
        float[0] = item;
        hash = imul(imul(hash ^ floatWords[0], 0x01000193) ^ floatWords[1], 0x01000193);
      } else {
        hash = hashNumbers(hash, item);
      }
    }
  }

  return hash;
}

function signText(sign: (word: number) => void, text: string): void {
  sign(text.length);
  for (let i = 0; i < text.length; i++) sign(text.charCodeAt(i));
}

function signGeometry(sign: (word: number) => void, geometry: GeoJSON.Geometry | null | undefined): void {
  if (!geometry) {
    sign(0);

    return;
  }

  signText(sign, geometry.type);

  if (geometry.type === 'GeometryCollection') {
    for (const member of geometry.geometries) signGeometry(sign, member);

    return;
  }

  signText(sign, geometryCoordinatesSignature(geometry));
}

const coordinateSignatures = new WeakMap<GeoJSON.Geometry, string>();

function geometryCoordinatesSignature(geometry: Exclude<GeoJSON.Geometry, GeoJSON.GeometryCollection>): string {
  let signature = coordinateSignatures.get(geometry);

  if (signature === undefined) {
    signature = (hashNumbers(0x811c9dc5, geometry.coordinates) >>> 0).toString(36);
    coordinateSignatures.set(geometry, signature);
  }

  return signature;
}

function cachedNumericSignature(subject: object, fill: (sign: (word: number) => void) => void): string {
  const cached = numericSignatures.get(subject);

  if (cached !== undefined) return cached;
  let hash = 0x811c9dc5;

  fill(word => {
    hash ^= word;
    hash = imul(hash, 0x01000193);
  });
  const signature = (hash >>> 0).toString(36);

  numericSignatures.set(subject, signature);

  return signature;
}

export function overlayGeometrySignature(geojson: GeoJSON.FeatureCollection): string {
  return cachedNumericSignature(geojson, sign => {
    sign(geojson.features.length);

    for (const feature of geojson.features) {
      signGeometry(sign, feature.geometry);
      signText(sign, feature.properties ? stableSignatureCached(feature.properties) : '');
    }
  });
}

function trackDataSignature(track: OverlayTrackData): string {
  return cachedNumericSignature(track, sign => {
    sign(hashNumbers(0x811c9dc5, track.elevation ?? []));
    sign(hashNumbers(0x811c9dc5, track.time ?? []));
    signText(sign, track.waypoints ? stableSignature(track.waypoints) : '');
  });
}

export function overlayRenderSignature(overlay: MapPlaceOverlay): string {
  return stableSignature({
    geometry: overlayGeometrySignature(overlay.geojson),
    track: overlay.track === null ? 'from-geometry' : overlay.track ? trackDataSignature(overlay.track) : '',
    style: overlay.style,
    pathLabels: overlay.pathLabels?.map(feature => stableSignature(feature)) ?? [],
  });
}

export function getPlaceTrackRenderHash(place: MapPlace): string {
  const renderProps = {
    overlay: place.overlay ? overlayRenderSignature(place.overlay) : '',
    trackColorBy: place.trackColorBy,
    trackColor: place.trackColor,
    trackWeight: place.trackWeight,
    trackOpacity: place.trackOpacity,
    trackStyle: place.trackStyle,
    trackDashArray: place.trackDashArray,
    trackOutline: place.trackOutline,
    trackOutlineStyle: place.trackOutlineStyle,
    trackOutlineColor: place.trackOutlineColor,
    trackOutlineWeight: place.trackOutlineWeight,
    trackOutlineOpacity: place.trackOutlineOpacity,
    trackZoom: place.trackZoom,
  };

  return getRenderSignature(renderProps);
}

export function getTrackStateRenderSignature(state: PlaceTrackState): string {
  return getRenderSignature({
    placeId: state.placeId,
    showOnLoad: state.showOnLoad,
    style: state.style,
    outline: state.outline,
    effectiveColorBy: state.effectiveColorBy,
    gradeWindow: state.gradeWindow,
    speedWindow: state.speedWindow,
    renderHash: getPlaceTrackRenderHash(state.place),
  });
}

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

export function resolveTrackVisibility(input: TrackVisibilityInput): TrackVisibilityResult {
  const { places, settings, clusteringEnabled } = input;
  const defaultState = settings.trackDefaultVisibility;
  const shouldShowByDefault = defaultState === 'visible';
  const explicitlyHidden = defaultState === 'hidden';
  const placesWithTracks = places.filter(p => hasTrackData(p));
  const isSingleTrackView = places.length === 1 && placesWithTracks.length === 1;
  const autoShowSingleTrack = isSingleTrackView && !clusteringEnabled && !explicitlyHidden;
  const blockColorBy = settings.trackColorBy;
  const defaultStyle = getTrackStyle(blockColorBy);
  const defaultOutline = settings.trackOutline ?? usesTrackGradient(blockColorBy);

  const placeStates: PlaceTrackState[] = placesWithTracks.map(place => {
    const placeId = getPlaceId(place);
    const showOnLoad = place.trackDefaultVisibility === 'visible'
      ? true
      : place.trackDefaultVisibility === 'hidden'
        ? false
        : shouldShowByDefault || autoShowSingleTrack;
    const effectiveColorBy = place.trackColorBy ?? blockColorBy;

    const { style, outline } = resolveTrackAppearance(place, { colorBy: blockColorBy, outline: settings.trackOutline });

    return {
      placeId, place, showOnLoad, style, outline, effectiveColorBy,
      gradeWindow: effectiveColorBy === 'grade' || effectiveColorBy === 'elevation' ? settings.trackGradeWindow : undefined,
      speedWindow: effectiveColorBy === 'speed' || effectiveColorBy === 'pace' ? settings.trackSpeedWindow : undefined,
    };
  });

  const placeStateMap = new Map<string, PlaceTrackState>();

  for (const state of placeStates) {
    placeStateMap.set(state.placeId, state);
  }

  return {
    placeStates,
    placeStateMap,
    hasAnyVisibleTracks: placeStates.some(s => s.showOnLoad),
    isSingleTrackView,
    shouldShowByDefault,
    defaultStyle,
    defaultOutline,
    blockOverlays: [...(input.overlays ?? [])],
  };
}

export function getStyleForPlace(visibility: TrackVisibilityResult | undefined, placeId: string, place?: MapPlace): CompleteTrackStyle & { outline: boolean } {
  const placeState = visibility?.placeStateMap.get(placeId);
  const sourcePlace = place ?? placeState?.place;
  const defaults = { style: placeState?.style ?? visibility?.defaultStyle, outline: placeState?.outline ?? visibility?.defaultOutline };

  return sourcePlace ? resolveTrackAppearance(sourcePlace, defaults)
    : { ...mergeWithDefaults({ style: defaults.style }), outline: defaults.outline ?? false };
}

export interface ExtractedTrackGeometry {
  encodedPolyline: string;
  coordinates: Coordinate[];
  elevations?: Meters[];
  waypoints?: Waypoint[];
}

export function extractTrackGeometry(place: MapPlace): ExtractedTrackGeometry | null {
  if (!place.overlay?.geojson) return null;

  const coordinates = extractCoordinatesFromOverlay(place.overlay);

  if (coordinates.length === 0) return null;

  return {
    encodedPolyline: PolylineCodec.encode(coordinates),
    coordinates,
    elevations: resolveOverlayTrackData(place.overlay)?.elevation,
    waypoints: resolveOverlayTrackData(place.overlay)?.waypoints,
  };
}

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

export function createSegmentOverlayPlace(options: SegmentOverlayOptions): MapPlace {
  const { coordinates, color, weight, opacity, style = 'solid', name = '', metadata } = options;
  const appearance = mergeWithDefaults({ style, dashArray: options.dashArray });

  const firstCoord = coordinates[0];

  if (!firstCoord) {
    throw new Error('createSegmentOverlayPlace requires at least one coordinate');
  }

  return {
    latitude: firstCoord[1],   
    longitude: firstCoord[0],
    name,
    icon: '',
    trackDefaultVisibility: 'visible',
    overlay: {
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            stroke: color,
            'stroke-width': weight,
            'stroke-opacity': opacity,
            'stroke-dasharray': dashArrayToPixels(appearance.dashArray, weight)
          },
          geometry: { type: 'LineString', coordinates }
        }]
      },
      style: {
        color,
        weight,
        opacity,
        style: appearance.style,
        dashArray: appearance.dashArray.join(',')
      }
    },
    metadata
  };
}

export function createBoundsAnchors(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): MapPlace[] {
  const corners = [
    { latitude: bounds.minLat, longitude: bounds.minLng },
    { latitude: bounds.minLat, longitude: bounds.maxLng },
    { latitude: bounds.maxLat, longitude: bounds.minLng },
    { latitude: bounds.maxLat, longitude: bounds.maxLng }
  ];

  return corners.map(corner => ({
    latitude: corner.latitude,
    longitude: corner.longitude,
    name: '',
    icon: '',
    metadata: { boundsAnchor: true }
  }));
}

export function extractCoordinatesFromOverlay(overlay: MapPlaceOverlay): Coordinate[] {
  return finishWork(extractCoordinatesFromOverlayWork(overlay));
}

export function* extractCoordinatesFromOverlayWork(overlay: MapPlaceOverlay): Generator<void, Coordinate[]> {
  const coords: Coordinate[] = [];

  const extractFromGeometry = function* (geometry: GeoJSON.Geometry): Generator<void> {
    if (geometry.type === 'LineString') {
      for (const coord of geometry.coordinates) {
        coords.push({ latitude: coord[1], longitude: coord[0] });
        if (coords.length % 128 === 0) yield;
      }
    } else if (geometry.type === 'MultiLineString') {
      for (const line of geometry.coordinates) {
        for (const coord of line) {
          coords.push({ latitude: coord[1], longitude: coord[0] });
          if (coords.length % 128 === 0) yield;
        }
      }
    }
  };

  if (overlay.geojson.type === 'FeatureCollection') {
    for (const feature of overlay.geojson.features) {
      if (feature.geometry) {
        yield* extractFromGeometry(feature.geometry);
      }
    }
  }

  return coords;
}
