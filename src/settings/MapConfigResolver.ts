import { DEFAULT_GRADE_DISTANCE_FEET, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from './MapDefaults';
import { DEFAULT_GRADE_WINDOW, DEFAULT_SPEED_WINDOW, MetricWindowError, parseMetricWindow, type MetricWindow } from './MetricWindow';
import { codeBlockText } from './CodeBlockYaml';
import { DEFAULT_TERRAIN_EXAGGERATION, DEFAULT_HILLSHADE_INTENSITY, DEFAULT_COLOR_RELIEF_OPACITY, HILLSHADE_METHODS, parseTerrainExaggeration, parseColorReliefStops } from '../map/TerrainDem';
import type { DirectionsDefinition, DirectionsRouteDefinition, DirectionsStyle, IsochroneDefinition, IsochroneStyle, MapConfigPatch, MapConfigSource, ResolvedMapConfig, ResolvedMapConfiguration } from './MapConfiguration';
import { parseBoolean, parseBooleanOptional, parseEnum, parseNumber } from './ParseHelpers';
import { CACHE_DEFAULT, CacheSettingError, parseCacheSetting, type CachePolicy } from './CachePolicy';
import { parseCoordinate } from '../geo/CoordinateParser';

// A non-fatal configuration warning (e.g. an unknown/misspelled key that was ignored).
export interface ConfigWarning {
  readonly path: string;
  readonly message: string;
}

// Root keys a block may carry without being warned about. Track settings are
// nested-only (`track:`), and no flat track spellings appear here.
const CONFIG_KEYS = new Set<string>([
  'height', 'width', 'mapProvider', 'style', 'initialZoom', 'initialCenter', 'minZoom',
  'showLabels', 'labelTemplate',
  'iconRotation', 'legend', 'query', 'dataview', 'embeddedPlaces', 'linkedPlaces',
  'radius', 'routeProvider', 'directions', 'isochrones', 'routeLabelTemplate', 'metricLabels',
  'legLabelTemplate', 'waypointLabelTemplate',
  'css', 'iconStyles', 'labelStyles', 'poiDiscovery', 'pitch', 'terrainProvider', 'reliefProvider', 'terrainExaggeration',
  'hillshadeIntensity', 'colorReliefOpacity', 'colorReliefColors', 'hillshadeMethod', 'hillshadeDirection',
  'hillshadeShadowColor', 'hillshadeHighlightColor', 'hillshadeAccentColor', 'debug',
  'poiFilterPatterns', 'heatmapLayer', 'heatmapColorScheme', 'markerRenderer', 'clusteringEnabled',
  'clusterThreshold', 'clusterGeoJsonOverlays',
  'tools',
]);

const DEFAULT_TRACK_BUILDER_SELECTABLE_LAYERS = Object.freeze(['transportation']);

export const CODED_MAP_DEFAULTS: ResolvedMapConfig = {
  height: DEFAULT_MAP_HEIGHT,
  width: DEFAULT_MAP_WIDTH,
  mapProvider: '',
  style: '',
  showLabels: true,
  trackDirectionArrows: 1,
  trackGradeWindow: DEFAULT_GRADE_WINDOW,
  trackSpeedWindow: DEFAULT_SPEED_WINDOW,
  legend: 'hidden',
  directions: [],
  isochrones: [],
  trackDetails: 'popup',
  css: '',
  poiDiscovery: true,
  pitch: false,
  terrainProvider: '',
  reliefProvider: '',
  terrainExaggeration: DEFAULT_TERRAIN_EXAGGERATION,
  hillshadeIntensity: 0,
  colorReliefOpacity: 0,
  hillshadeMethod: 'standard',
  debug: false,
  poiFilterPatterns: [],
  heatmapLayer: false,
  markerRenderer: 'native',
  clusteringEnabled: false,
  clusterThreshold: 0,
  clusterGeoJsonOverlays: false,
  trackBuilder: Object.freeze({
    tracks: Object.freeze([]),
    respectGradeSeparation: false,
    selectableLayers: DEFAULT_TRACK_BUILDER_SELECTABLE_LAYERS }),
  tools: Object.freeze({}) };

export interface MapConfigLayer {
  readonly source: Exclude<MapConfigSource, 'coded'>;
  readonly values: MapConfigPatch;
}

// Direction-arrow chevron scale: a non-negative number (0 disables); true/false accepted as 1/0.
function parseDirectionArrowScale(value: unknown): number | undefined {
  const scale = optionalNumber(value);
  return scale === undefined ? undefined : Math.max(0, scale);
}

export function parseMapConfigPatch(raw: Readonly<Record<string, unknown>>, warnings?: ConfigWarning[]): MapConfigPatch {
  const previousSink = warningSink;
  warningSink = warnings ?? null;
  try {
    return buildMapConfigPatch(raw);
  } finally {
    warningSink = previousSink;
  }
}

function buildMapConfigPatch(raw: Readonly<Record<string, unknown>>): MapConfigPatch {
  const text = (key: string): string | undefined => codeBlockText(raw, key);
  return compactPatch({
    height: text('height'),
    width: text('width'),
    mapProvider: text('mapProvider'),
    style: text('style'),
    initialZoom: optionalNumber(raw.initialZoom),
    initialCenter: parseInitialCenter(raw.initialCenter),
    minZoom: optionalNumber(raw.minZoom),
    showLabels: optionalBoolean(raw.showLabels),
    labelTemplate: text('labelTemplate'),
    iconRotation: text('iconRotation'),
    legend: parseEnum(raw.legend, ['hidden', 'top', 'bottom'] as const),
    query: text('query'),
    dataview: text('dataview'),
    embeddedPlaces: text('embeddedPlaces'),
    linkedPlaces: text('linkedPlaces'),
    radius: text('radius'),
    routeProvider: text('routeProvider'),
    directions: parseDirectionsDefinitions(raw.directions),
    isochrones: parseIsochroneDefinitions(raw.isochrones),
    routeLabelTemplate: text('routeLabelTemplate'),
    metricLabels: parseEnum(raw.metricLabels, ['total', 'legs', 'both', 'none'] as const),
    legLabelTemplate: text('legLabelTemplate'),
    waypointLabelTemplate: text('waypointLabelTemplate'),
    css: text('css'),
    iconStyles: parseTextRules(raw.iconStyles),
    labelStyles: parseTextRules(raw.labelStyles),
    poiDiscovery: optionalBoolean(raw.poiDiscovery),
    pitch: optionalBoolean(raw.pitch),
    ...parseTerrain(raw.terrain),
    ...parseTrackConfig(raw),
    debug: optionalBoolean(raw.debug),
    poiFilterPatterns: parseStringArray(raw.poiFilterPatterns),
    heatmapLayer: optionalBoolean(raw.heatmapLayer),
    heatmapColorScheme: text('heatmapColorScheme'),
    markerRenderer: parseEnum(raw.markerRenderer, ['native', 'html'] as const),
    clusteringEnabled: optionalBoolean(raw.clusteringEnabled),
    clusterThreshold: optionalNumber(raw.clusterThreshold),
    clusterGeoJsonOverlays: optionalBoolean(raw.clusterGeoJsonOverlays),
    tools: parseTools(raw.tools),
    location: text('location'),
    showHelpWithEmptyMap: optionalBoolean(raw.showHelpWithEmptyMap),
    ...parseSelectionConfig(raw) });
}

// Resolve the selection binding read off blockSettings by the processor and chart, from the
// nested public schema: root `selection:` (itemParameter/pointParameter/channel) wins over
// `track.selection` (trackParameter/pointParameter).
function parseSelectionConfig(raw: Readonly<Record<string, unknown>>): Partial<MapConfigPatch> {
  const track = asMapping(raw.track);
  const trackSelection = asMapping(track?.selection);
  const selection = asMapping(raw.selection);
  const asText = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
  return {
    selectionParameter: asText(selection?.itemParameter) ?? asText(trackSelection?.trackParameter),
    selectionPointParameter: asText(selection?.pointParameter) ?? asText(trackSelection?.pointParameter),
    selectionChannel: asText(selection?.channel) };
}

function asMapping(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

// Track settings are nested-only; resolved field names are the nested paths
// camel-cased (`track.labels.end` -> `trackLabelsEnd`).
function parseTrackConfig(raw: Readonly<Record<string, unknown>>): Partial<MapConfigPatch> {
  const track = asMapping(raw.track);
  const labels = asMapping(track?.labels);
  const arrows = track?.directionArrows;
  // `gradeWindow:` wins when a block carries both spellings.
  return {
    trackDirectionArrows: parseDirectionArrowScale(typeof arrows === 'boolean' ? (arrows ? 1 : 0) : arrows),
    trackDetails: parseEnum(track?.details, ['popup', 'panel'] as const),
    trackColorBy: parseEnum(track?.colorBy, ['none', 'elevation', 'grade', 'speed', 'pace'] as const),
    trackOutline: parseBooleanOptional(track?.outline),
    trackDefaultVisibility: parseEnum(track?.defaultVisibility, ['visible', 'hidden'] as const),
    trackGradeWindow: resolveGradeWindow(track?.gradeWindow, track?.gradeDistance),
    trackSpeedWindow: resolveNamedWindow('track.speedWindow', track?.speedWindow),
    trackLabelsVisibility: labels === undefined ? undefined : codeBlockText(labels, 'visibility'),
    trackLabelsStart: labels === undefined ? undefined : codeBlockText(labels, 'start'),
    trackLabelsMidpoint: labels === undefined ? undefined : codeBlockText(labels, 'midpoint'),
    trackLabelsEnd: labels === undefined ? undefined : codeBlockText(labels, 'end') };
}

function parseTools(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) return undefined;
  const tools = requireObject('tools', value);
  const parsed: Record<string, unknown> = {};
  for (const [id, config] of Object.entries(tools)) {
    if (!/^[a-z][a-z0-9-]*$/i.test(id)) {
      throw new Error(`tools contains invalid tool id "${id}". Use letters, digits, and hyphens.`);
    }
    if (config !== false) requireObject(`tools.${id}`, config);
    parsed[id] = cloneValue(config);
  }
  return Object.freeze(parsed);
}

export function resolveMapConfiguration(layers: readonly MapConfigLayer[]): ResolvedMapConfiguration {
  const resolved: ResolvedMapConfig = { ...CODED_MAP_DEFAULTS };
  const provenance: Partial<Record<keyof ResolvedMapConfig, MapConfigSource>> = {};
  for (const key of Object.keys(CODED_MAP_DEFAULTS) as Array<keyof ResolvedMapConfig>) provenance[key] = 'coded';
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer.values) as Array<[keyof MapConfigPatch, MapConfigPatch[keyof MapConfigPatch]]>) {
      if (value === undefined) continue;
      Object.assign(resolved, { [key]: cloneValue(value) });
      provenance[key] = layer.source;
    }
  }

  const reliefSource = resolved.reliefProvider ? 'reliefProvider' : resolved.terrainProvider ? 'terrainProvider' : undefined;
  if (reliefSource) {
    if (provenance.hillshadeIntensity === 'coded') {
      Object.assign(resolved, { hillshadeIntensity: DEFAULT_HILLSHADE_INTENSITY });
      provenance.hillshadeIntensity = provenance[reliefSource];
    }
    if (provenance.colorReliefOpacity === 'coded') {
      Object.assign(resolved, { colorReliefOpacity: DEFAULT_COLOR_RELIEF_OPACITY });
      provenance.colorReliefOpacity = provenance[reliefSource];
    }
  }
  return { config: Object.freeze(resolved), provenance: Object.freeze(provenance) };
}

export function mapConfigKeys(): ReadonlySet<string> {
  return CONFIG_KEYS;
}

// Nested settings, as the dotted paths a user writes. Track and terrain have no
// flat spellings, so a caller that walks CONFIG_KEYS alone would miss them.
const NESTED_CONFIG_PATHS: readonly string[] = Object.freeze([
  'track.colorBy', 'track.outline', 'track.details', 'track.defaultVisibility',
  'track.directionArrows', 'track.gradeWindow', 'track.gradeDistance', 'track.speedWindow',
  'track.labels.visibility', 'track.labels.start', 'track.labels.midpoint', 'track.labels.end',
  'terrain.provider', 'terrain.reliefProvider', 'terrain.exaggeration',
  'terrain.hillshade.intensity', 'terrain.hillshade.method', 'terrain.hillshade.direction',
  'terrain.hillshade.shadowColor', 'terrain.hillshade.highlightColor', 'terrain.hillshade.accentColor',
  'terrain.colorRelief.opacity', 'terrain.colorRelief.colors',
]);

// Every settable path, for surfaces that read settings one key at a time instead of
// parsing a block. A Bases view keeps its own list of keys it understands, and a
// setting added here has to reach it without a second edit.
export function mapConfigPaths(): readonly string[] {
  return Object.freeze([...CONFIG_KEYS, ...NESTED_CONFIG_PATHS]);
}

function compactPatch(values: MapConfigPatch): MapConfigPatch {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function optionalBoolean(value: unknown): boolean | undefined {
  return value === undefined ? undefined : parseBoolean(value, false);
}

function optionalNumber(value: unknown): number | undefined {
  return value === undefined ? undefined : parseNumber(value, 0);
}

// Parse a 0-1 unit interval (hillshade intensity, color-relief opacity), clamped; undefined when absent.
function optionalUnitInterval(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseNumber(value, 0);
  return Math.max(0, Math.min(1, parsed));
}

function parseInitialCenter(value: unknown): readonly [number, number] | undefined {
  const coordinate = Array.isArray(value) ? parseCoordinate(value.join(',')) : parseCoordinate(value);
  return coordinate ? [coordinate.longitude, coordinate.latitude] : undefined;
}

function parseTextRules(value: unknown): string | readonly string[] | undefined {
  if (typeof value === 'string') return value;
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : undefined;
}

function parseStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : undefined;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (typeof value === 'object' && value !== null) return { ...value };
  return value;
}

function parseTerrain(value: unknown): MapConfigPatch {
  if (value === undefined) return {};
  const terrain = requireObject('terrain', value);
  assertKnownKeys('terrain', terrain, ['provider', 'reliefProvider', 'exaggeration', 'hillshade', 'colorRelief']);

  const patch: Record<string, unknown> = {
    terrainProvider: optionalText('terrain.provider', terrain.provider),
    reliefProvider: optionalText('terrain.reliefProvider', terrain.reliefProvider),
    terrainExaggeration: parseTerrainExaggeration(terrain.exaggeration) };

  if (terrain.hillshade !== undefined) {
    const hillshade = requireObject('terrain.hillshade', terrain.hillshade);
    assertKnownKeys('terrain.hillshade', hillshade, ['intensity', 'method', 'direction', 'shadowColor', 'highlightColor', 'accentColor']);
    patch.hillshadeIntensity = optionalUnitInterval(hillshade.intensity);
    patch.hillshadeMethod = parseEnum(hillshade.method, HILLSHADE_METHODS);
    patch.hillshadeDirection = optionalNumber(hillshade.direction);
    patch.hillshadeShadowColor = optionalText('terrain.hillshade.shadowColor', hillshade.shadowColor);
    patch.hillshadeHighlightColor = optionalText('terrain.hillshade.highlightColor', hillshade.highlightColor);
    patch.hillshadeAccentColor = optionalText('terrain.hillshade.accentColor', hillshade.accentColor);
  }

  if (terrain.colorRelief !== undefined) {
    const colorRelief = requireObject('terrain.colorRelief', terrain.colorRelief);
    assertKnownKeys('terrain.colorRelief', colorRelief, ['opacity', 'colors']);
    patch.colorReliefOpacity = optionalUnitInterval(colorRelief.opacity);
    patch.colorReliefColors = parseColorReliefStops(colorRelief.colors);
  }

  return compactPatch(patch);
}

function parseDirectionsDefinitions(value: unknown): readonly DirectionsDefinition[] | undefined {
  if (value === undefined) return undefined;
  const entries = requireObjectList('directions', value);
  return entries.map((entry, index) => {
    assertKnownKeys(`directions[${index}]`, entry, ['name', 'provider', 'mode', 'routes', 'optimize', 'traffic', 'cache', 'metricLabels', 'labelTemplate', 'legLabelTemplate', 'waypointLabelTemplate', 'style', 'visible']);
    if (!Array.isArray(entry.routes) || entry.routes.length === 0) throw new Error(`directions[${index}].routes must be a non-empty list.`);
    const routes: DirectionsRouteDefinition[] = entry.routes.map((route, routeIndex) => {
      const path = `directions[${index}].routes[${routeIndex}]`;
      if (typeof route !== 'object' || route === null || Array.isArray(route)) {
        throw new Error(`${path} must be a mapping containing exactly one of "waypoints" or "query". Use "- waypoints:" followed by at least two indented waypoint entries, or "- query: SELECT ...".`);
      }
      const record = route as Record<string, unknown>;
      assertKnownKeys(path, record, ['waypoints', 'query']);
      const hasWaypoints = record.waypoints !== undefined;
      const hasQuery = record.query !== undefined;
      if (hasWaypoints === hasQuery) throw new Error(`${path} must contain exactly one of "waypoints" or "query". Use "- waypoints:" followed by at least two indented waypoint entries, or "- query: SELECT ...".`);
      if (hasQuery) return { kind: 'query', query: requireText(`${path}.query`, record.query) };
      const waypoints = requireTextList(`${path}.waypoints`, record.waypoints);
      if (waypoints.length < 2) throw new Error(`${path}.waypoints requires at least two entries.`);
      return { kind: 'waypoints', waypoints };
    });
    return {
      kind: 'directions', routes,
      visible: optionalBoolean(entry.visible) ?? true,
      name: optionalText(`directions[${index}].name`, entry.name),
      provider: optionalText(`directions[${index}].provider`, entry.provider),
      mode: optionalEnum(`directions[${index}].mode`, entry.mode, ['drive', 'walk', 'bike']) ?? 'drive',
      optimize: optionalStrictBoolean(`directions[${index}].optimize`, entry.optimize) ?? false,
      traffic: optionalStrictBoolean(`directions[${index}].traffic`, entry.traffic) ?? false,
      cache: optionalCachePolicy(`directions[${index}].cache`, entry.cache),
      metricLabels: optionalEnum(`directions[${index}].metricLabels`, entry.metricLabels, ['total', 'legs', 'both', 'none']) ?? 'none',
      labelTemplate: optionalText(`directions[${index}].labelTemplate`, entry.labelTemplate),
      legLabelTemplate: optionalText(`directions[${index}].legLabelTemplate`, entry.legLabelTemplate),
      waypointLabelTemplate: optionalText(`directions[${index}].waypointLabelTemplate`, entry.waypointLabelTemplate),
      style: parseDirectionsStyle(`directions[${index}].style`, entry.style) };
  });
}

function parseDirectionsStyle(path: string, value: unknown): DirectionsStyle | undefined {
  if (value === undefined) return undefined;
  const obj = requireObject(path, value);
  assertKnownKeys(path, obj, ['color', 'strokeWidth', 'strokeOpacity']);
  return {
    color: optionalText(`${path}.color`, obj.color),
    strokeWidth: optionalFiniteNumber(`${path}.strokeWidth`, obj.strokeWidth),
    strokeOpacity: optionalFiniteNumber(`${path}.strokeOpacity`, obj.strokeOpacity) };
}

function parseIsochroneDefinitions(value: unknown): readonly IsochroneDefinition[] | undefined {
  if (value === undefined) return undefined;
  return requireObjectList('isochrones', value).map((entry, index) => {
    const path = `isochrones[${index}]`;
    assertKnownKeys(path, entry, ['name', 'provider', 'mode', 'centers', 'ranges', 'polygons', 'traffic', 'cache', 'style', 'minZoom', 'maxZoom', 'visible']);
    const ranges = parseIsochroneRanges(`${path}.ranges`, entry.ranges);
    const centers = requireTextList(`${path}.centers`, entry.centers);
    if (centers.length === 0) throw new Error(`${path}.centers must be a non-empty list.`);
    return {
      kind: 'isochrone', centers, ranges,
      visible: optionalBoolean(entry.visible) ?? true,
      name: optionalText(`${path}.name`, entry.name),
      provider: optionalText(`${path}.provider`, entry.provider),
      mode: optionalEnum(`${path}.mode`, entry.mode, ['drive', 'walk', 'bike']) ?? 'drive',
      polygons: optionalStrictBoolean(`${path}.polygons`, entry.polygons) ?? true,
      traffic: optionalStrictBoolean(`${path}.traffic`, entry.traffic) ?? false,
      cache: optionalCachePolicy(`${path}.cache`, entry.cache),
      style: parseIsochroneStyle(`${path}.style`, entry.style),
      minZoom: optionalFiniteNumber(`${path}.minZoom`, entry.minZoom),
      maxZoom: optionalFiniteNumber(`${path}.maxZoom`, entry.maxZoom) };
  });
}

function parseIsochroneStyle(path: string, value: unknown): IsochroneStyle | undefined {
  if (value === undefined) return undefined;
  const obj = requireObject(path, value);
  assertKnownKeys(path, obj, ['colors', 'strokeWidth', 'strokeOpacity', 'fillOpacity']);
  return {
    colors: obj.colors === undefined ? undefined : requireTextList(`${path}.colors`, obj.colors),
    strokeWidth: optionalFiniteNumber(`${path}.strokeWidth`, obj.strokeWidth),
    strokeOpacity: optionalFiniteNumber(`${path}.strokeOpacity`, obj.strokeOpacity),
    fillOpacity: optionalFiniteNumber(`${path}.fillOpacity`, obj.fillOpacity) };
}

function parseIsochroneRanges(path: string, value: unknown): IsochroneDefinition['ranges'] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty YAML list with a time or distance unit on every value.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`${path}[${index}] must include a time or distance unit (for example, "30 min" or "5 mi").`);
    }
    const match = entry.trim().match(/^(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|h(?:ou)?rs?|m(?:eters?)?|km|kilometers?|mi|miles?|ft|feet|foot)$/i);
    if (!match) {
      throw new Error(`${path}[${index}] must be a positive time or distance (for example, "30 min" or "5 mi").`);
    }
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`${path}[${index}] must be positive.`);
    }
    const unit = match[2].toLowerCase();
    if (/^min/.test(unit)) return { type: 'time' as const, value: amount };
    if (/^h/.test(unit)) return { type: 'time' as const, value: amount * 60 };
    if (unit === 'km' || /^kilometer/.test(unit)) return { type: 'distance' as const, value: amount * 1000 };
    if (unit === 'mi' || /^mile/.test(unit)) return { type: 'distance' as const, value: amount * 1609.344 };
    if (unit === 'ft' || unit === 'feet' || unit === 'foot') return { type: 'distance' as const, value: amount * 0.3048 };
    return { type: 'distance' as const, value: amount };
  });
}

function requireObjectList(path: string, value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be a YAML list of mappings.`);
  return value.map((entry, index) => requireObject(`${path}[${index}]`, entry));
}
function requireObject(path: string, value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${path} must be a mapping.`);
  return value as Record<string, unknown>;
}
// When set (by parseMapConfigPatch), unknown keys are collected as non-fatal warnings and
// parsing continues; when null, assertKnownKeys throws (strict mode - what tests and any
// caller that does not supply a sink get). The main render path always supplies a sink: a
// misspelled key warns below the map instead of blanking it.
let warningSink: ConfigWarning[] | null = null;

function assertKnownKeys(path: string, value: Record<string, unknown>, keys: readonly string[]): void {
  const known = new Set(keys);
  const unknown = Object.keys(value).filter(key => !known.has(key));
  if (!unknown.length) return;
  if (warningSink) {
    for (const key of unknown) warningSink.push({ path, message: `unknown key "${key}" - ignored` });
  } else {
    throw new Error(`${path} contains unknown ${unknown.length === 1 ? 'key' : 'keys'}: ${unknown.join(', ')}.`);
  }
}
function requireText(path: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} must be non-empty text.`);
  return value.trim();
}
function optionalText(path: string, value: unknown): string | undefined { return value === undefined ? undefined : requireText(path, value); }
function requireTextList(path: string, value: unknown): string[] {
  const items: unknown[] = Array.isArray(value) ? value : [];
  if (!Array.isArray(value) || !items.every((item): item is string => typeof item === 'string' && item.trim() !== '')) throw new Error(`${path} must be a list of non-empty text values.`);
  return items.map(item => item.trim());
}
function optionalFiniteNumber(path: string, value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be a number.`);
  return value;
}
function optionalStrictBoolean(path: string, value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${path} must be true or false.`);
  return value;
}
// `cache:` uses the same grammar everywhere (see CachePolicy). YAML turns a
// bare `2027-01-01` into a Date and `true` into a boolean, and both reach the
// parser as-is rather than as text.
function optionalCachePolicy(path: string, value: unknown): CachePolicy {
  try {
    return parseCacheSetting(value instanceof Date ? value.toISOString().slice(0, 10) : value, CACHE_DEFAULT);
  } catch (error) {
    if (error instanceof CacheSettingError) throw new Error(`${path}: ${error.message}`);
    throw error;
  }
}
// A rolling-metric window from either spelling. `gradeWindow:` carries its own
// unit; the legacy `gradeDistance:` is a bare number of feet.
function resolveGradeWindow(windowValue: unknown, legacyFeet: unknown): MetricWindow | undefined {
  if (windowValue !== undefined && windowValue !== null && windowValue !== '') {
    try {
      return parseMetricWindow(windowValue, DEFAULT_GRADE_WINDOW);
    } catch (error) {
      if (error instanceof MetricWindowError) throw new Error(`track.gradeWindow: ${error.message}`);
      throw error;
    }
  }
  if (legacyFeet === undefined || legacyFeet === null || legacyFeet === '') return undefined;
  const feetValue = parseNumber(legacyFeet, DEFAULT_GRADE_DISTANCE_FEET);
  return { kind: 'distance', km: feetValue * 0.0003048 };
}

// A window setting that carries its own unit, reported under its own key on failure.
function resolveNamedWindow(setting: string, value: unknown): MetricWindow | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  try {
    return parseMetricWindow(value, DEFAULT_SPEED_WINDOW);
  } catch (error) {
    if (error instanceof MetricWindowError) throw new Error(`${setting}: ${error.message}`);
    throw error;
  }
}

function optionalEnum<T extends string>(path: string, value: unknown, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`${path} must be one of: ${allowed.join(', ')}.`);
  return value as T;
}
