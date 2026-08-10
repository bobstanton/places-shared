import type * as GeoJSON from 'geojson';
import { MapPlace, MapPlaceOverlay, hasTrackData, Waypoint } from '../Place';
import type { TrackColorBy } from './TrackRenderer';
import type { ResolvedMapConfig } from '../settings/MapConfiguration';
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
}

export function mergeWithDefaults(partialStyle?: PartialTrackStyle): CompleteTrackStyle {
  let dashArray: number[];
  if (partialStyle?.dashArray !== undefined && partialStyle?.dashArray !== null) {
    if (typeof partialStyle.dashArray === 'string') {
      dashArray = partialStyle.dashArray.split(',').map(n => parseFloat(n.trim()));
    } else if (typeof partialStyle.dashArray === 'number') {
      dashArray = [partialStyle.dashArray, partialStyle.dashArray];
    } else if (Array.isArray(partialStyle.dashArray)) {
      dashArray = partialStyle.dashArray;
    } else {
      dashArray = TRACK_STYLE_DEFAULTS.dashArray;
    }
  } else {
    const styleType = partialStyle?.style ?? TRACK_STYLE_DEFAULTS.style;
    dashArray = styleType === 'dashed' ? TRACK_STYLE_DEFAULTS.dashArray : [];
  }

  return {
    style: partialStyle?.style ?? TRACK_STYLE_DEFAULTS.style,
    dashArray,
    color: partialStyle?.color ?? TRACK_STYLE_DEFAULTS.color,
    outlineColor: partialStyle?.outlineColor ?? TRACK_STYLE_DEFAULTS.outlineColor,
    weight: partialStyle?.weight ?? TRACK_STYLE_DEFAULTS.weight,
    outlineWeight: partialStyle?.outlineWeight ?? TRACK_STYLE_DEFAULTS.outlineWeight,
    opacity: partialStyle?.opacity ?? TRACK_STYLE_DEFAULTS.opacity,
    outlineOpacity: partialStyle?.outlineOpacity ?? TRACK_STYLE_DEFAULTS.outlineOpacity,
  };
}

export function getTrackStyle(coloringType?: TrackColorBy): 'solid' | 'dashed' {
  return (coloringType === 'grade' || coloringType === 'elevation') ? 'solid' : 'dashed';
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

export function getPlaceMarkerRenderSignature(place: MapPlace): string {
  const markerProps = {
    latitude: place.latitude,
    longitude: place.longitude,
    icon: place.icon,
    name: place.name,
    originalName: place.originalName,
    filePath: place.filePath,
    tags: place.tags,
    iconStyle: place.iconStyle,
    labelStyle: place.labelStyle,
    // Every rendered marker property must appear here; an omitted one leaves
    // the signature unchanged and the marker stale.
    iconRotation: place.iconRotation,
    dataAttributes: place.dataAttributes,
    metadata: place.metadata ? stableSignatureCached(place.metadata) : '',
    trackDefaultVisibility: place.trackDefaultVisibility,
    overlayShape: overlayShapeSignature(place),
  };
  return getRenderSignature(markerProps);
}

export function getPlaceTrackRenderHash(place: MapPlace): string {
  const renderProps = {
    overlay: place.overlay ? stableSignatureCached(place.overlay) : '',
    trackColorBy: place.trackColorBy,
    trackColor: place.trackColor,
    trackWeight: place.trackWeight,
    trackOpacity: place.trackOpacity,
    trackStyle: place.trackStyle,
    trackDashArray: place.trackDashArray,
    trackOutline: place.trackOutline,
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
  const defaultUsesGradient = defaultStyle === 'solid';
  const defaultOutline = defaultUsesGradient || (settings.trackOutline === true);

  const placeStates: PlaceTrackState[] = placesWithTracks.map(place => {
    const placeId = getPlaceId(place);
    const showOnLoad = place.trackDefaultVisibility === 'visible'
      ? true
      : place.trackDefaultVisibility === 'hidden'
        ? false
        : shouldShowByDefault || autoShowSingleTrack;
    const effectiveColorBy = place.trackColorBy ?? blockColorBy;

    // Per-note trackStyle (frontmatter) lands on place.track*.
    const placeStyle = place.overlay?.style?.style ?? (place.trackStyle as 'solid' | 'dashed' | undefined);
    const colorByStyle = getTrackStyle(effectiveColorBy);
    const style: 'solid' | 'dashed' = (placeStyle === 'solid' || placeStyle === 'dashed') ? placeStyle : colorByStyle;

    const usesGradient = colorByStyle === 'solid';
    const placeDefaultOutline = usesGradient || (settings.trackOutline === true);
    const outline = place.overlay?.style?.outline ?? place.trackOutline ?? settings.trackOutline ?? placeDefaultOutline;

    return { placeId, place, showOnLoad, style, outline, effectiveColorBy };
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
  const style = placeState?.style ?? visibility?.defaultStyle ?? TRACK_STYLE_DEFAULTS.style;
  const outline = placeState?.outline ?? visibility?.defaultOutline ?? false;

  const overlayStyle = place?.overlay?.style;

  return {
    style,
    dashArray: overlayStyle?.dashArray
      ? overlayStyle.dashArray.split(',').map(n => parseFloat(n.trim()))
      : (style === 'dashed' ? TRACK_STYLE_DEFAULTS.dashArray : []),
    color: overlayStyle?.color ?? place?.trackColor ?? TRACK_STYLE_DEFAULTS.color,
    outlineColor: overlayStyle?.outlineColor ?? place?.trackOutlineColor ?? TRACK_STYLE_DEFAULTS.outlineColor,
    weight: overlayStyle?.weight ?? place?.trackWeight ?? TRACK_STYLE_DEFAULTS.weight,
    outlineWeight: overlayStyle?.outlineWeight ?? place?.trackOutlineWeight ?? TRACK_STYLE_DEFAULTS.outlineWeight,
    opacity: overlayStyle?.opacity ?? place?.trackOpacity ?? TRACK_STYLE_DEFAULTS.opacity,
    outlineOpacity: overlayStyle?.outlineOpacity ?? place?.trackOutlineOpacity ?? TRACK_STYLE_DEFAULTS.outlineOpacity,
    outline,
  };
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
    elevations: place.overlay.track?.elevation,
    waypoints: place.overlay.track?.waypoints,
  };
}

export interface SegmentOverlayOptions {
  coordinates: [number, number][];
  color: string;
  weight: number;
  opacity: number;
  style?: 'solid' | 'dashed';
  name?: string;
  metadata?: Record<string, unknown>;
}

export function createSegmentOverlayPlace(options: SegmentOverlayOptions): MapPlace {
  const { coordinates, color, weight, opacity, style = 'solid', name = '', metadata } = options;

  const firstCoord = coordinates[0];
  if (!firstCoord) {
    throw new Error('createSegmentOverlayPlace requires at least one coordinate');
  }

  return {
    latitude: firstCoord[1],  // GeoJSON is [lon, lat]
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
            'stroke-dasharray': style === 'dashed' ? '2,2' : ''
          },
          geometry: { type: 'LineString', coordinates }
        }]
      },
      style: {
        color,
        weight,
        opacity,
        style
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
  const coords: Coordinate[] = [];

  const extractFromGeometry = (geometry: GeoJSON.Geometry) => {
    if (geometry.type === 'LineString') {
      for (const coord of geometry.coordinates) {
        coords.push({ latitude: coord[1], longitude: coord[0] });
      }
    } else if (geometry.type === 'MultiLineString') {
      for (const line of geometry.coordinates) {
        for (const coord of line) {
          coords.push({ latitude: coord[1], longitude: coord[0] });
        }
      }
    }
  };

  if (overlay.geojson.type === 'FeatureCollection') {
    for (const feature of overlay.geojson.features) {
      if (feature.geometry) {
        extractFromGeometry(feature.geometry);
      }
    }
  }

  return coords;
}
