import type * as GeoJSON from 'geojson';
import { sharedRegistryValue } from '../utils/CrossBundleRegistry';

export const WAYPOINT_ICON_PROPERTY = '_placesWaypointIcon';

export interface WaypointIconSource {
  name?: unknown;
  symbol?: unknown;
  type?: unknown;
}

export interface CompiledWaypointIconMappings {
  readonly names: ReadonlyMap<string, string>;
  readonly symbols: ReadonlyMap<string, string>;
  readonly types: ReadonlyMap<string, string>;
}

const DEFAULT_WAYPOINT_ICON_MAPPINGS = [
  'Campground => 🏕️',
  'Flag => 🚩',
  'Parking => 🅿️',
  'Restroom => 🚻',
  'Trailhead => 🥾',
  'Endpoint => 🏁',
  'Summit => ⛰️',
  'Water => 💧',
  'Food => 🍽️',
  'Danger => ⚠️',
  'Drinking Fountain => 🚰',
  'Waterfall => 🌊',
  'Overlook => 👀',
];

export const CURRENT_WAYPOINT_ICON_MAPPINGS_REVISION = 1;

export function defaultWaypointIconMappings(): string[] {
  return [...DEFAULT_WAYPOINT_ICON_MAPPINGS];
}

function normalizeWaypointIconKey(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
    : '';
}

type WaypointIconMappingTarget = 'name' | 'symbol' | 'type' | 'all';

function parseWaypointIconMapping(line: string): { target: WaypointIconMappingTarget; key: string; icon: string } | undefined {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) return undefined;
  const arrowIndex = trimmed.indexOf('=>');

  if (arrowIndex < 0) return undefined;

  let matcher = trimmed.slice(0, arrowIndex).trim();
  const icon = trimmed.slice(arrowIndex + 2).trim();
  let target: WaypointIconMappingTarget = 'all';
  const targeted = matcher.match(/^(name|sym|symbol|type)\s*:\s*(.*)$/i);

  if (targeted) {
    const scope = targeted[1].toLowerCase();

    target = scope === 'name' || scope === 'type' ? scope : 'symbol';
    matcher = targeted[2];
  }

  const key = normalizeWaypointIconKey(matcher);

  return key && icon ? { target, key, icon } : undefined;
}

export function compileWaypointIconMappings(lines: readonly string[] | undefined): CompiledWaypointIconMappings {
  const names = new Map<string, string>();
  const symbols = new Map<string, string>();
  const types = new Map<string, string>();

  for (const line of lines ?? []) {
    const mapping = parseWaypointIconMapping(line);

    if (!mapping) continue;
    if (mapping.target === 'all' || mapping.target === 'name') names.set(mapping.key, mapping.icon);
    if (mapping.target === 'all' || mapping.target === 'symbol') symbols.set(mapping.key, mapping.icon);
    if (mapping.target === 'all' || mapping.target === 'type') types.set(mapping.key, mapping.icon);
  }

  return { names, symbols, types };
}

interface WaypointIconMappingRegistry {
  mappings: CompiledWaypointIconMappings;
}

const WAYPOINT_ICON_MAPPING_REGISTRY_KEY = Symbol.for('places.waypoint.icon.mappings');

function configuredMappingRegistry(): WaypointIconMappingRegistry {
  return sharedRegistryValue(WAYPOINT_ICON_MAPPING_REGISTRY_KEY, () => ({
    mappings: compileWaypointIconMappings(defaultWaypointIconMappings()),
  }));
}

export function configureWaypointIconMappings(lines: readonly string[] | undefined): void {
  configuredMappingRegistry().mappings = compileWaypointIconMappings(lines);
}

type WaypointGeoJson = NonNullable<GeoJSON.GeoJSON<GeoJSON.Geometry | null>>;

const appliedWaypointIconCache = new WeakMap<object, WeakMap<object, WaypointGeoJson>>();

function literalWaypointIcon(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();

  return trimmed && !/[\p{L}\p{N}]/u.test(trimmed) ? trimmed : undefined;
}

export function resolveWaypointIcon(source: WaypointIconSource, mappings: CompiledWaypointIconMappings = configuredMappingRegistry().mappings): string | undefined {
  const symbolKey = normalizeWaypointIconKey(source.symbol);

  if (symbolKey) {
    const icon = mappings.symbols.get(symbolKey);

    if (icon) return icon;
  }

  const literal = literalWaypointIcon(source.symbol);

  if (literal) return literal;

  const typeKey = normalizeWaypointIconKey(source.type);

  if (typeKey) {
    const icon = mappings.types.get(typeKey);

    if (icon) return icon;
  }

  const nameKey = normalizeWaypointIconKey(source.name);

  return nameKey ? mappings.names.get(nameKey) : undefined;
}

export function applyWaypointIconsToGeoJson<T extends WaypointGeoJson>(geojson: T, mappings?: CompiledWaypointIconMappings): T;

export function applyWaypointIconsToGeoJson(geojson: WaypointGeoJson, mappings: CompiledWaypointIconMappings = configuredMappingRegistry().mappings): WaypointGeoJson {
  let mappedByConfiguration = appliedWaypointIconCache.get(geojson);
  const cached = mappedByConfiguration?.get(mappings);

  if (cached) return cached;

  const apply = (
    feature: GeoJSON.Feature<GeoJSON.Geometry | null, Record<string, unknown> | null>,
  ): GeoJSON.Feature<GeoJSON.Geometry | null, Record<string, unknown> | null> => {
    const properties = feature.properties;

    if (!properties || feature.geometry?.type !== 'Point') return feature;

    if (
      properties.route_endpoint
      || properties.route_label_point
      || properties._placesTrackEndpoint
      || properties._placesWaypointLabelApplied
    ) return feature;

    const icon = resolveWaypointIcon({
      name: properties.name,
      symbol: properties.symbol,
      type: properties.type,
    }, mappings);
    const current = properties[WAYPOINT_ICON_PROPERTY];

    if (icon === current || (icon === undefined && current === undefined)) return feature;

    const nextProperties: Record<string, unknown> = { ...properties };

    if (icon) nextProperties[WAYPOINT_ICON_PROPERTY] = icon;
    else delete nextProperties[WAYPOINT_ICON_PROPERTY];

    return { ...feature, properties: nextProperties };
  };

  let result: WaypointGeoJson = geojson;

  if (geojson.type === 'FeatureCollection') {
    let changed = false;
    const features = geojson.features.map(feature => {
      const next = apply(feature);

      changed ||= next !== feature;

      return next;
    });

    result = changed ? { ...geojson, features } : geojson;
  } else if (geojson.type === 'Feature') {
    result = apply(geojson);
  }

  if (!mappedByConfiguration) {
    mappedByConfiguration = new WeakMap<object, WaypointGeoJson>();
    appliedWaypointIconCache.set(geojson, mappedByConfiguration);
  }

  mappedByConfiguration.set(mappings, result);

  return result;
}

export function upgradeWaypointIconMappings(lines: readonly string[] | undefined, revision: unknown): string[] {
  const mappings = lines ? [...lines] : [];
  const numericRevision = typeof revision === 'number' && Number.isFinite(revision) ? revision : 0;

  if (numericRevision >= CURRENT_WAYPOINT_ICON_MAPPINGS_REVISION) return mappings;

  const compiled = compileWaypointIconMappings(mappings);
  const configuredKeys = new Set([
    ...compiled.names.keys(),
    ...compiled.symbols.keys(),
    ...compiled.types.keys(),
  ]);

  for (const defaultLine of DEFAULT_WAYPOINT_ICON_MAPPINGS) {
    const parsed = parseWaypointIconMapping(defaultLine);

    if (!parsed) continue;

    if (!configuredKeys.has(parsed.key)) {
      mappings.push(defaultLine);
      configuredKeys.add(parsed.key);
    }
  }

  return mappings;
}
