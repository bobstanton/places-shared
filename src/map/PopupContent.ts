import type * as GeoJSON from 'geojson';
import type { MapPlace } from '../Place';
import type { PopupRendererOptions } from '../settings/PopupConfiguration';
import { GENERATED_OVERLAY_PROPERTY } from '../services/RouteOverlayGeoJson';
import { getFileNameWithoutExtension, scalarToString } from '../utils/Utilities';

export const KNOWN_PLACE_CONTEXT_KEYS = new Set([
  'name',
  'originalName',
  'title',
  'filename',
  'path',
  'icon',
  'latitude',
  'longitude',
  'tags',
  'frontmatter',
  'row',
]);

export interface PlacePopupTarget {
  readonly kind: 'place';
  readonly place: MapPlace;
  readonly markdownSourcePath?: string;
}

export interface FeaturePopupTarget {
  readonly kind: 'feature';
  readonly feature: GeoJSON.Feature;
  readonly sourcePath?: string;
  readonly index?: number;
  readonly presentation?: 'feature' | 'point';
  readonly markdownSourcePath?: string;
}

export type PopupTarget = PlacePopupTarget | FeaturePopupTarget;

export interface ResolvedPopupField {
  readonly label: string;
  readonly value: string;
}

export type PopupRendererOutputSection =
  | { readonly type: 'fields'; readonly fields: readonly ResolvedPopupField[] }
  | { readonly type: 'markdown'; readonly markdown: string }
  | { readonly type: 'note' };

export interface PopupRendererRequest {
  readonly target: PopupTarget;
  readonly context: Readonly<Record<string, unknown>>;
  readonly markdownSourcePath?: string;
  readonly options?: PopupRendererOptions;
}

export interface PopupRendererMetadata {
  readonly id: string;
  readonly description?: string;
}

export interface PortablePopupRenderer extends PopupRendererMetadata {
  readonly kind: 'sections';
  render(request: PopupRendererRequest): readonly PopupRendererOutputSection[] | Promise<readonly PopupRendererOutputSection[]>;
}

export interface PopupDomRendererRequest extends PopupRendererRequest {
  readonly container: HTMLElement;
  readonly renderMarkdown: (markdown: string, container?: HTMLElement) => Promise<void>;
  readonly onDispose: (cleanup: () => void) => void;
}

export interface PopupDomRenderer extends PopupRendererMetadata {
  readonly kind: 'dom';
  render(request: PopupDomRendererRequest): void | (() => void) | Promise<void | (() => void)>;
}

export type PopupRenderer = PortablePopupRenderer | PopupDomRenderer;

export function toTitleCaseFrontmatterKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildPlaceTemplateContext(place: MapPlace): Record<string, unknown> {
  const filename = getFileNameWithoutExtension(place.filePath, place.name, /\.md$/i);
  const context: Record<string, unknown> = {
    ...(place.queryRow ?? {}),
    ...(place.metadata ?? {}),
    frontmatter: place.metadata ?? {},
    row: place.queryRow ?? {},
    name: place.name,
    originalName: place.originalName ?? place.name,
    title: filename,
    filename,
    path: place.filePath ?? '',
    icon: place.icon,
    latitude: place.latitude,
    longitude: place.longitude,
    tags: place.tags ?? [],
  };

  addPropertyAliases(context, place.queryRow);
  addPropertyAliases(context, place.metadata);

  return context;
}

export function buildFeatureTemplateContext(feature: GeoJSON.Feature, index?: number, source = ''): Record<string, unknown> {
  const properties = isMapping(feature.properties) ? feature.properties : {};

  return {
    role: properties._placesGpxWaypoint === true ? 'waypoint' : '',
    role_label: '',
    ...properties,
    properties,
    geometry: feature.geometry,
    feature,
    ...(index === undefined ? {} : { index }),
    source,
  };
}

export function buildPopupTemplateContext(target: PopupTarget): Record<string, unknown> {
  return target.kind === 'place'
    ? buildPlaceTemplateContext(target.place)
    : buildFeatureTemplateContext(target.feature, target.index, target.sourcePath ?? '');
}

export function getPopupTargetSourcePath(target: PopupTarget): string | undefined {
  if (target.kind === 'place') return target.place.filePath;
  const properties = isMapping(target.feature.properties) ? target.feature.properties : {};

  if (properties.route_endpoint) {
    const endpointPath = properties.route_endpoint_path;

    return typeof endpointPath === 'string' && endpointPath ? endpointPath : undefined;
  }

  return properties[GENERATED_OVERLAY_PROPERTY] ? undefined : target.sourcePath;
}

export function getPopupMarkdownSourcePath(target: PopupTarget): string | undefined {
  return target.markdownSourcePath ?? getPopupTargetSourcePath(target);
}

export function formatPopupFieldValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatPopupFieldValue).join(', ');
  if (value instanceof Date) return value.toISOString();

  if (isMapping(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return scalarToString(value);
    }
  }

  return scalarToString(value);
}

function addPropertyAliases(context: Record<string, unknown>, properties: Record<string, unknown> | undefined): void {
  if (!properties) return;

  for (const [key, value] of Object.entries(properties)) {
    let aliases = propertyAliases.get(key);

    if (!aliases) {
      const lower = key.toLowerCase();

      aliases = [...new Set([lower, key.replace(/\s+/g, '_').toLowerCase(),
        ...(key === lower || /[_-]/.test(key) ? [toTitleCaseFrontmatterKey(key)] : [])])];
      propertyAliases.set(key, aliases);
      if (propertyAliases.size > 2000) propertyAliases.delete(propertyAliases.keys().next().value!);
    }

    for (const alias of aliases) setAlias(context, alias, value);
  }
}

const propertyAliases = new Map<string, string[]>();

function setAlias(context: Record<string, unknown>, key: string, value: unknown): void {
  if (!key || key in context || KNOWN_PLACE_CONTEXT_KEYS.has(key)) return;
  context[key] = value;
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
