import { formatKmInSystem, formatMetersInSystem, meters, metersToKm, kmToMiles, type UnitsSystem } from '../Units';
import type * as GeoJSON from 'geojson';
import { PlaceholderResolver } from 'placeholder-resolver/dist/PlaceholderResolver.js';
import type { ContextProvider } from 'placeholder-resolver/dist/types.js';
import type { DirectionsOverlayRequest, IsochroneOverlayStyle, RouteMetricLabels, RouteWaypoint } from './IRouteOverlayService';
import { OVERLAY_RENDER_BAND_PROPERTY } from '../overlay/OverlaySystem';
import { DEFAULT_ROUTE_LABEL_TEMPLATE, DEFAULT_WAYPOINT_LABEL_TEMPLATE } from '../settings/CodeBlockSettings';
import { getCoordinateAtDistance, getLineDistance, getMidCoordinate } from './PathLabelFeatures';
import { stripSurroundingQuotes } from '../utils/ValueGuards';
import { coerceScalarString } from '../utils/Utilities';

export const DEFAULT_ROUTE_LEG_LABEL_TEMPLATE = '{this.from_name} → {this.to_name}: {this.distance_text} · {this.duration_text}';

export interface RouteLegMetricInput {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteLegMetric {
  index: number;
  from_index: number;
  to_index: number;
  from_name: string;
  to_name: string;
  distance_meters: number;
  distance_text: string;
  duration_seconds: number;
  duration_text: string;
}

export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function formatRouteDistance(value: number, units: UnitsSystem = 'imperial'): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const distance = meters(value);
  const kilometers = metersToKm(distance);
  const longDistance = units === 'metric' ? kilometers >= 1 : kmToMiles(kilometers) >= 1;

  return longDistance ? formatKmInSystem(kilometers, units, 1) : formatMetersInSystem(distance, units);
}

export function formatRouteWaypointName(point: { latitude: number; longitude: number; name?: string }): string {
  return point.name ?? `${point.latitude}, ${point.longitude}`;
}

export function formatRouteWaypointCoordinate(point: { latitude: number; longitude: number }): number[] {
  return [point.longitude, point.latitude];
}

// Waypoint properties every route feature carries, in final visit order.
export function buildRouteWaypointProperties(route: RouteWaypoint[]): { waypoints: string[]; waypoint_coordinates: number[][]; waypoint_paths: Array<string | null>; waypoint_icons: Array<string | null> } {
  return {
    waypoints: route.map(formatRouteWaypointName),
    waypoint_coordinates: route.map(formatRouteWaypointCoordinate),
    waypoint_paths: route.map((point) => point.sourcePath || null),
    waypoint_icons: route.map((point) => point.icon || null),
  };
}

export function buildRouteLegMetrics(route: RouteWaypoint[], legs: RouteLegMetricInput[], units: UnitsSystem = 'imperial'): RouteLegMetric[] {
  return legs.slice(0, Math.max(0, route.length - 1)).map((leg, index) => {
    const from = route[index];
    const to = route[index + 1];

    return {
      index,
      from_index: index,
      to_index: index + 1,
      from_name: from ? formatRouteWaypointName(from) : `Stop ${index + 1}`,
      to_name: to ? formatRouteWaypointName(to) : `Stop ${index + 2}`,
      distance_meters: leg.distanceMeters,
      distance_text: formatRouteDistance(leg.distanceMeters, units),
      duration_seconds: leg.durationSeconds,
      duration_text: formatRouteDuration(leg.durationSeconds),
    };
  });
}

export function buildRouteLegProperties(legs: RouteLegMetric[]): { leg_count: number; route_legs: RouteLegMetric[]; route_legs_json: string } {
  return {
    leg_count: legs.length,
    route_legs: legs,
    route_legs_json: JSON.stringify(legs),
  };
}

export interface RouteFeatureInput {
  request: DirectionsOverlayRequest;
  provider: string;
  routeIndex: number;
  route: RouteWaypoint[];
  geometry: GeoJSON.Geometry;
  optimized: boolean;
  distanceMeters: number;
  durationSeconds: number;
  legs: RouteLegMetric[];
}

export function buildDirectionsRouteFeature(input: RouteFeatureInput): GeoJSON.Feature {
  const { request, provider, routeIndex, route, geometry, optimized, distanceMeters, durationSeconds, legs } = input;

  return {
    type: "Feature",
    geometry,
    properties: {
      name: request.name ? `${request.name} ${routeIndex + 1}` : `Route ${routeIndex + 1}`,
      provider,
      mode: request.mode,
      units: request.units ?? 'imperial',
      optimized,
      route_index: routeIndex,
      ...buildRouteWaypointProperties(route),
      start_name: route.length ? formatRouteWaypointName(route[0]) : "",
      end_name: route.length ? formatRouteWaypointName(route[route.length - 1]) : "",
      ...buildRouteLegProperties(legs),
      distance_meters: distanceMeters,
      distance_text: formatRouteDistance(distanceMeters, request.units),
      duration_seconds: durationSeconds,
      duration_text: formatRouteDuration(durationSeconds),
      stroke: request.style?.color ?? "#2563eb",
      "stroke-width": request.style?.strokeWidth ?? 5,
      "stroke-opacity": request.style?.strokeOpacity ?? 0.85,
    },
  };
}

export async function appendDirectionsRouteFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, request: DirectionsOverlayRequest): Promise<void> {
  features.push(routeFeature);
  await addRouteEndpointFeatures(features, routeFeature, request.waypointLabelTemplate);

  await addRouteMetricLabelFeatures(features, routeFeature, request.metricLabels, request.labelTemplate, request.legLabelTemplate);
}

// Marks features produced by directions/isochrones generation. Their popups must not link to the synthetic overlay source path.
export const GENERATED_OVERLAY_PROPERTY = 'places_generated_overlay';

export function markGeneratedOverlayFeatures(collection: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  for (const feature of collection.features ?? []) {
    feature.properties = { ...(feature.properties ?? {}), [GENERATED_OVERLAY_PROPERTY]: true };
  }

  return collection;
}

export function formatIsochroneFeatureName(baseName: string | undefined, mode: string, rangeText: string): string {
  return [baseName ?? 'Isochrone', mode, rangeText].join(' · ');
}

export const DEFAULT_ISOCHRONE_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#f59e0b', '#dc2626'];

export function getIsochroneStyleColor(index: number, style?: IsochroneOverlayStyle): string {
  const palette = style?.colors && style.colors.length > 0 ? style.colors : DEFAULT_ISOCHRONE_COLORS;

  return palette[index % palette.length];
}

export function getIsochroneStyleColors(count: number, style?: IsochroneOverlayStyle): string[] {
  return Array.from({ length: count }, (_, index) => getIsochroneStyleColor(index, style));
}

export function decorateIsochroneFeatureProperties(baseProperties: GeoJSON.GeoJsonProperties, color: string, style?: IsochroneOverlayStyle): GeoJSON.GeoJsonProperties {
  return {
    ...(baseProperties ?? {}),
    [OVERLAY_RENDER_BAND_PROPERTY]: 'background',
    stroke: color,
    'stroke-width': style?.strokeWidth ?? 2,
    'stroke-opacity': style?.strokeOpacity ?? 0.9,
    fill: color,
    'fill-opacity': style?.fillOpacity ?? 0.22,
  };
}

export * from './PathLabelFeatures';

export function addRouteLabelFeature(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, label: string): void {
  const trimmed = normalizeRouteLabel(routeFeature.properties, label).trim();

  if (!trimmed) return;
  const labelProperties: GeoJSON.GeoJsonProperties = {
    route_label: trimmed,
  };

  routeFeature.properties = {
    ...(routeFeature.properties ?? {}),
    ...labelProperties,
  };

  const labelCoordinate = getRouteLabelCoordinate(routeFeature.geometry);

  if (!labelCoordinate) return;

  features.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: labelCoordinate,
    },
    properties: {
      name: trimmed,
      ...labelProperties,
      route_label_point: true,
    },
  });
}

export async function addRouteMetricLabelFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, metricLabels: RouteMetricLabels | undefined, totalTemplate?: string, legTemplate?: string): Promise<void> {
  const mode = metricLabels ?? 'total';

  if (mode === 'none') return;

  if (mode === 'total' || mode === 'both') {
    addRouteLabelFeature(features, routeFeature, await resolveRouteLabel(routeFeature.properties, totalTemplate));
  }

  if (mode === 'legs' || mode === 'both') {
    await addRouteLegLabelFeatures(features, routeFeature, legTemplate);
  }
}

export async function addRouteLegLabelFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, template?: string): Promise<void> {
  const legs = getRouteLegMetrics(routeFeature.properties);

  if (legs.length === 0) return;
  const geometry = routeFeature.geometry;

  if (!geometry) return;
  const totalDistance = legs.reduce((sum, leg) => sum + Math.max(0, Number(leg.distance_meters) || 0), 0);
  let cumulativeDistance = 0;

  for (const leg of legs) {
    const legDistance = Math.max(0, Number(leg.distance_meters) || 0);
    const labelCoordinate = getRouteLegLabelCoordinate(geometry, cumulativeDistance + legDistance / 2, totalDistance);

    cumulativeDistance += legDistance;
    if (!labelCoordinate) continue;

    const label = (await resolveRouteLegLabel(leg, template, routeFeature.properties?.units === 'metric' ? 'metric' : 'imperial')).trim();

    if (!label) continue;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: labelCoordinate,
      },
      properties: {
        name: label,
        route_label: label,
        route_label_point: true,
        route_leg_label: label,
        route_leg_label_point: true,
        route_leg_index: leg.index,
      },
    });
  }
}

// Append the start / stop / end marker features for a route. The visible label at each waypoint is
// resolved from `waypointLabelTemplate` (empty hides; absent uses the coded default
// `{this.role_label}: {this.name}`) against a per-endpoint context.
export async function addRouteEndpointFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, waypointLabelTemplate?: string): Promise<void> {
  const endpoints = getRouteEndpointCoordinates(routeFeature.geometry);

  if (!endpoints) return;

  const waypoints: unknown = routeFeature.properties?.waypoints;
  const waypointPaths = getRouteWaypointStrings(routeFeature.properties, 'waypoint_paths');
  const waypointIcons = getRouteWaypointStrings(routeFeature.properties, 'waypoint_icons');
  const nameAt = (index: number): string => (Array.isArray(waypoints) && waypoints[index] ? String(waypoints[index]) : '');
  const lastIndex = Array.isArray(waypoints) ? waypoints.length - 1 : 0;
  const waypointCoordinates = getRouteWaypointCoordinates(routeFeature.properties);

  const endpointFeatures: Array<Promise<GeoJSON.Feature>> = [];
  const push = (coordinate: GeoJSON.Position, context: RouteWaypointContext, color: string): void => {
    endpointFeatures.push(
      resolveRouteWaypointLabel(context, waypointLabelTemplate).then((label) =>
        createRouteEndpointFeature(coordinate, context, label, color)),
    );
  };

  push(endpoints.start, { name: nameAt(0) || 'Start', index: 0, role: 'start', role_label: 'Start', icon: waypointIcons[0] ?? '', path: waypointPaths[0] ?? '' }, '#16a34a');

  if (waypointCoordinates.length > 2) {
    for (let index = 1; index < waypointCoordinates.length - 1; index++) {
      push(waypointCoordinates[index], { name: nameAt(index), index, role: 'stop', role_label: `Stop ${index}`, icon: waypointIcons[index] ?? '', path: waypointPaths[index] ?? '' }, '#facc15');
    }
  }

  push(endpoints.end, { name: nameAt(lastIndex) || 'End', index: lastIndex, role: 'end', role_label: 'End', icon: waypointIcons[waypointIcons.length - 1] ?? '', path: waypointPaths[waypointPaths.length - 1] ?? '' }, '#dc2626');

  features.push(...(await Promise.all(endpointFeatures)));
}

export async function resolveRouteLabel(properties: GeoJSON.GeoJsonProperties, template?: string): Promise<string> {
  const fallback = formatDefaultRouteLabel(properties);
  const cleanTemplate = stripSurroundingQuotes(template ?? DEFAULT_ROUTE_LABEL_TEMPLATE).trim();

  if (!cleanTemplate) return fallback;

  try {
    const simpleResolved = resolveSimpleRouteTemplate(cleanTemplate, properties);

    if (simpleResolved !== null) return simpleResolved || fallback;

    const resolver = new PlaceholderResolver(new RouteFeatureContextProvider(properties ?? {}));
    const resolved = (await resolver.resolve(cleanTemplate)).trim();

    return resolved || fallback;
  } catch {
    return fallback;
  }
}

export function normalizeRouteLabel(properties: GeoJSON.GeoJsonProperties, label?: string): string {
  const fallback = formatDefaultRouteLabel(properties);
  const value = String(label ?? '').trim();

  if (!value) return fallback;
  if (looksLikeUnresolvedRouteTemplate(value)) return fallback;

  return value;
}

function formatDefaultRouteLabel(properties: GeoJSON.GeoJsonProperties): string {
  const distance = normalizeDistanceText(properties);
  const duration = normalizeDurationText(properties);

  return [distance, duration].filter(Boolean).join(' · ');
}

function normalizeDistanceText(properties: GeoJSON.GeoJsonProperties): string {
  const explicit = String(properties?.distance_text ?? '').trim();

  if (explicit && !looksLikeUnresolvedRouteTemplate(explicit)) return explicit;

  return formatRouteDistance(Number(properties?.distance_meters), properties?.units === 'metric' ? 'metric' : 'imperial');
}

function normalizeDurationText(properties: GeoJSON.GeoJsonProperties): string {
  const explicit = String(properties?.duration_text ?? '').trim();

  if (explicit && !looksLikeUnresolvedRouteTemplate(explicit)) return explicit;

  return formatRouteDuration(Number(properties?.duration_seconds));
}

function looksLikeUnresolvedRouteTemplate(value: string): boolean {
  return /\{[^}]*this\.[^}]*\}/.test(value) ||
    /\bthis\.(distance|duration)[A-Za-z_]*\b/.test(value);
}

interface RouteTemplateProperties {
  distance_text?: unknown;
  duration_text?: unknown;
  distance_meters?: unknown;
  duration_seconds?: unknown;
}

function resolveSimpleRouteTemplate(template: string, properties: RouteTemplateProperties | null | undefined): string | null {
  if (!/\{this\.(distance_text|duration_text|distance_meters|duration_seconds)\}/.test(template)) {
    return null;
  }

  const resolved = template
    .replace(/\{this\.distance_text\}/g, coerceScalarString(properties?.distance_text))
    .replace(/\{this\.duration_text\}/g, coerceScalarString(properties?.duration_text))
    .replace(/\{this\.distance_meters\}/g, coerceScalarString(properties?.distance_meters))
    .replace(/\{this\.duration_seconds\}/g, coerceScalarString(properties?.duration_seconds))
    .trim();

  // A placeholder beyond the four metric fields ({this.to_name}, helper
  // expressions) needs the full resolver; returning a half-resolved string
  // would label the map with literal template text.
  return /\{[^{}]*\}/.test(resolved) ? null : resolved;
}

async function resolveRouteLegLabel(leg: RouteLegMetric, template: string | undefined, units: UnitsSystem): Promise<string> {
  const cleanTemplate = stripSurroundingQuotes(template ?? DEFAULT_ROUTE_LEG_LABEL_TEMPLATE).trim();
  const fallback = `${leg.from_name} → ${leg.to_name}: ${leg.distance_text || formatRouteDistance(leg.distance_meters, units)} · ${formatRouteDuration(leg.duration_seconds)}`.trim();

  if (!cleanTemplate) return fallback;

  try {
    const simpleResolved = resolveSimpleRouteTemplate(cleanTemplate, leg);

    if (simpleResolved !== null) return simpleResolved || fallback;

    const resolver = new PlaceholderResolver(new RouteFeatureContextProvider(leg));
    const resolved = (await resolver.resolve(cleanTemplate)).trim();

    return resolved || fallback;
  } catch {
    return fallback;
  }
}

// Template context for a single route waypoint marker (start / stop N / end).
export interface RouteWaypointContext {
  name: string;
  index: number;
  role: 'start' | 'stop' | 'end';
  role_label: string;
  icon: string;
  path: string;
}

// An empty template hides the label (returns ''); an absent template uses the coded default.
async function resolveRouteWaypointLabel(context: RouteWaypointContext, template?: string): Promise<string> {
  const cleanTemplate = stripSurroundingQuotes(template ?? DEFAULT_WAYPOINT_LABEL_TEMPLATE).trim();

  if (!cleanTemplate) return '';
  const fallback = context.role_label ? `${context.role_label}: ${context.name}`.trim() : context.name;

  try {
    const resolver = new PlaceholderResolver(new RouteFeatureContextProvider(context));
    const resolved = (await resolver.resolve(cleanTemplate)).trim();

    return resolved || fallback;
  } catch {
    return fallback;
  }
}

class RouteFeatureContextProvider implements ContextProvider {
  constructor(private readonly properties: object | null | undefined) {}

  getEagerProperties(): Record<string, unknown> {
    return this.properties ? Object.fromEntries(Object.entries(this.properties)) : {};
  }
}

function getRouteLabelCoordinate(geometry: GeoJSON.Geometry | null): GeoJSON.Position | null {
  if (!geometry) return null;

  if (geometry.type === 'LineString') {
    return getMidCoordinate(geometry.coordinates);
  }

  if (geometry.type === 'MultiLineString') {
    const longestLine = geometry.coordinates.reduce<GeoJSON.Position[]>((longest, line) =>
      line.length > longest.length ? line : longest, []);

    return getMidCoordinate(longestLine);
  }

  return null;
}

function getRouteEndpointCoordinates(geometry: GeoJSON.Geometry | null): { start: GeoJSON.Position; end: GeoJSON.Position } | null {
  if (!geometry) return null;

  if (geometry.type === 'LineString') {
    const start = geometry.coordinates[0];
    const end = geometry.coordinates[geometry.coordinates.length - 1];

    return start && end ? { start, end } : null;
  }

  if (geometry.type === 'MultiLineString') {
    const firstLine = geometry.coordinates.find((line) => line.length > 0);
    const lastLine = [...geometry.coordinates].reverse().find((line) => line.length > 0);
    const start = firstLine?.[0];
    const end = lastLine?.[lastLine.length - 1];

    return start && end ? { start, end } : null;
  }

  return null;
}

function getRouteWaypointCoordinates(properties: GeoJSON.GeoJsonProperties): GeoJSON.Position[] {
  const raw: unknown = properties?.waypoint_coordinates;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((coordinate): GeoJSON.Position | null => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
      const lng = Number(coordinate[0]);
      const lat = Number(coordinate[1]);

      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

      return [lng, lat];
    })
    .filter((coordinate): coordinate is GeoJSON.Position => coordinate !== null);
}

function getRouteLegMetrics(properties: GeoJSON.GeoJsonProperties): RouteLegMetric[] {
  const raw: unknown = properties?.route_legs;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((value): RouteLegMetric | null => {
      if (!value || typeof value !== 'object') return null;
      const leg = value as Partial<RouteLegMetric>;
      const index = Number(leg.index);
      const distanceMeters = Number(leg.distance_meters);
      const durationSeconds = Number(leg.duration_seconds);

      if (!Number.isFinite(index)) return null;

      return {
        index,
        from_index: Number(leg.from_index ?? index),
        to_index: Number(leg.to_index ?? index + 1),
        from_name: String(leg.from_name ?? `Stop ${index + 1}`),
        to_name: String(leg.to_name ?? `Stop ${index + 2}`),
        distance_meters: Number.isFinite(distanceMeters) ? distanceMeters : 0,
        distance_text: String(leg.distance_text ?? ''),
        duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        duration_text: String(leg.duration_text ?? ''),
      };
    })
    .filter((leg): leg is RouteLegMetric => leg !== null);
}

function getRouteWaypointStrings(properties: GeoJSON.GeoJsonProperties, key: 'waypoint_paths' | 'waypoint_icons'): Array<string | null> {
  const raw: unknown = properties?.[key];

  if (!Array.isArray(raw)) return [];

  return raw.map((value) => (typeof value === 'string' && value ? value : null));
}

function createRouteEndpointFeature(coordinate: GeoJSON.Position, context: RouteWaypointContext, label: string, color: string): GeoJSON.Feature {
  const endpoint = context.role === 'stop' ? 'midpoint' : context.role;

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coordinate,
    },
    properties: {
      name: label || context.name,
      route_endpoint: endpoint,
      // Empty label (template resolved to nothing / explicitly hidden) keeps the marker but drops its text.
      ...(label ? { route_endpoint_label: label } : {}),
      ...(context.role === 'stop' ? { route_waypoint_index: context.index } : {}),
      ...(context.path ? { route_endpoint_path: context.path } : {}),
      ...(context.icon ? { route_endpoint_icon: context.icon } : {}),
      'marker-color': color,
      'circle-radius': 6,
      'fill-opacity': 0.95,
      stroke: '#ffffff',
      'stroke-width': 2,
      'stroke-opacity': 1,
    },
  };
}

function getRouteLegLabelCoordinate(geometry: GeoJSON.Geometry, targetDistance: number, routeDistance: number): GeoJSON.Position | null {
  if (!Number.isFinite(targetDistance) || targetDistance < 0) return getRouteLabelCoordinate(geometry);
  const coordinates = getGeometryLineCoordinates(geometry);

  if (coordinates.length === 0) return null;
  const geometryDistance = getLineDistance(coordinates);

  if (geometryDistance <= 0) return getMidCoordinate(coordinates);
  const scaledTarget = routeDistance > 0 ? (targetDistance / routeDistance) * geometryDistance : targetDistance;

  return getCoordinateAtDistance(coordinates, scaledTarget);
}

function getGeometryLineCoordinates(geometry: GeoJSON.Geometry): GeoJSON.Position[] {
  if (geometry.type === 'LineString') return geometry.coordinates;

  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.reduce<GeoJSON.Position[]>((longest, line) =>
      getLineDistance(line) > getLineDistance(longest) ? line : longest, []);
  }

  return [];
}
