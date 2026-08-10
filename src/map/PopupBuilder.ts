import { getFileNameWithoutExtension, preventWheelPropagation, scalarToString } from "../utils/Utilities";
import { formatMetersInSystem, meters, type UnitsSystem } from "../Units";
import type * as GeoJSON from "geojson";
import { PlaceAction, MapPlace, Place } from "../Place";
import { renderSearchResult } from "./SearchResultRenderer";
import { GENERATED_OVERLAY_PROPERTY } from "../services/RouteOverlayGeoJson";

export interface PopupOptions {
  icon?: string;
  name: string;
  isLink: boolean;
  linkPath?: string;
  subtitle?: string;
  actions?: Array<{ text: string; onClick: () => void; icon?: string; keepOpen?: boolean }>;
  placeActions?: PlaceAction[];
  onPlaceAction?: (actionId: string, state: { checked?: boolean }) => void;
  closePopup?: () => void;
  onLinkClick?: (linkPath: string) => void;
  debug?: PopupDebugInfo;
}

export interface PopupDebugInfo {
  fields: Array<{ field: string; value: string }>;
  filterRules: Array<{ rule: string; valid: boolean; matched: boolean }>;
}

export const PopupClasses = {
  container: 'places-popup-content',
  header: 'places-popup-header',
  icon: 'places-popup-icon',
  name: 'places-popup-name',
  subtitle: 'places-popup-subtitle',
  actions: 'places-popup-actions',
  actionItem: 'places-context-menu-item',
  actionIcon: 'places-context-menu-icon',
} as const;

export interface PopupWheelGuardTarget {
  on(type: 'open', listener: () => void): unknown;
  getElement(): HTMLElement | undefined;
}

export function attachPopupWheelGuard(popup: PopupWheelGuardTarget): void {
  popup.on('open', () => {
    const el = popup.getElement();
    if (el) {
      preventWheelPropagation(el);
    }
  });
}

const LEADING_EMOJI_PATTERN = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u;

export interface PopupActionRow {
  label: string;
  icon?: string;
  checked?: boolean;
  keepOpen?: boolean;
  onSelect: (state: { checked?: boolean }) => void;
}

function appendActionRows(container: HTMLElement, rows: PopupActionRow[], closePopup?: () => void): void {
  if (rows.length === 0) return;

  const actionsDiv = container.createDiv({ cls: PopupClasses.actions });
  for (const row of rows) {
    if (row.checked !== undefined) {
      const item = actionsDiv.createEl('label', { cls: `${PopupClasses.actionItem} places-popup-action-toggle` });
      const checkbox = item.createEl('input', { type: 'checkbox' });
      checkbox.checked = row.checked;
      checkbox.addEventListener('change', () => row.onSelect({ checked: checkbox.checked }));
      item.createSpan({ text: row.label });
      continue;
    }

    const item = actionsDiv.createDiv({ cls: PopupClasses.actionItem });
    const emojiMatch = row.icon ? null : row.label.match(LEADING_EMOJI_PATTERN);
    if (row.icon) {
      item.createSpan({ text: row.icon, cls: PopupClasses.actionIcon });
      item.createSpan({ text: row.label });
    } else if (emojiMatch) {
      item.createSpan({ text: emojiMatch[1], cls: PopupClasses.actionIcon });
      item.createSpan({ text: row.label.slice(emojiMatch[0].length) });
    } else {
      item.createSpan({ text: row.label });
    }
    item.onclick = () => {
      row.onSelect({});
      if (!row.keepOpen) closePopup?.();
    };
  }
}

// The shared body of every place popup.
function appendPlaceSection(container: HTMLElement, options: PopupOptions): void {
  const header = container.createDiv({ cls: PopupClasses.header });

  if (options.icon) {
    header.createSpan({ text: options.icon, cls: PopupClasses.icon });
  }

  if (options.isLink) {
    const linkTarget = options.linkPath || options.name;
    const linkEl = header.createEl('a', {
      text: options.name,
      href: linkTarget,
      cls: `internal-link ${PopupClasses.name}`
    });
    if (options.onLinkClick) {
      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        // Stop the event reaching Obsidian's delegated internal-link handler, which
        // would otherwise open the same link a second time from the href.
        e.stopPropagation();
        options.onLinkClick!(linkTarget);
      });
    }
  } else {
    header.createSpan({ text: options.name, cls: PopupClasses.name });
  }

  if (options.subtitle) {
    container.createDiv({ text: options.subtitle, cls: PopupClasses.subtitle });
  }

  const onPlaceAction = options.onPlaceAction;
  if (options.placeActions && onPlaceAction) {
    appendActionRows(container, options.placeActions.map(action => ({
      label: action.label,
      checked: action.checked,
      onSelect: state => onPlaceAction(action.id, state),
    })), options.closePopup);
  }
}

export function buildMultiPlacePopupContent(options: { title: string; places: PopupOptions[] }): HTMLElement {
  const container = createDiv({ cls: `${PopupClasses.container} places-popup-multi` });
  preventWheelPropagation(container);

  container.createDiv({ text: options.title, cls: 'places-popup-multi-title' });

  for (const place of options.places) {
    appendPlaceSection(container.createDiv({ cls: 'places-popup-multi-place' }), place);
  }

  return container;
}

export function buildPopupContent(options: PopupOptions): HTMLElement {
  const container = createDiv({ cls: PopupClasses.container });

  preventWheelPropagation(container);

  appendPlaceSection(container, options);

  if (options.actions) {
    appendActionRows(container, options.actions.map(action => ({
      label: action.text,
      icon: action.icon,
      keepOpen: action.keepOpen,
      onSelect: () => action.onClick(),
    })), options.closePopup);
  }

  if (options.debug) {
    appendPopupDebugSection(container, options.debug);
  }

  return container;
}

function appendPopupDebugSection(container: HTMLElement, debug: PopupDebugInfo): void {
  const details = container.createEl('details', { cls: 'places-popup-debug' });
  details.createEl('summary', { text: 'Debug: fields & filters' });

  if (debug.filterRules.length > 0) {
    const rules = details.createDiv({ cls: 'places-popup-debug-rules' });
    for (const entry of debug.filterRules) {
      const row = rules.createDiv({ cls: 'places-popup-debug-rule' });
      row.createSpan({
        cls: entry.valid ? (entry.matched ? 'places-popup-debug-match' : 'places-popup-debug-miss') : 'places-popup-debug-invalid',
        text: entry.valid ? (entry.matched ? '✓' : '✕') : '⚠',
      });
      row.createEl('code', { text: entry.rule });
    }
  }

  if (debug.fields.length === 0) {
    details.createDiv({ cls: 'places-popup-debug-empty', text: 'No metadata fields on this place.' });
    return;
  }
  const table = details.createEl('table', { cls: 'places-popup-debug-fields' });
  for (const { field, value } of debug.fields) {
    const row = table.createEl('tr');
    row.createEl('td', { text: field });
    row.createEl('td', { text: value });
  }
}

export function buildGeocodingSearchPopupContent(place: MapPlace, onPlaceAction?: (place: MapPlace, actionId: string, state: { checked?: boolean }) => void, closePopup?: () => void): HTMLElement {
  const searchResult = place.metadata?.geocodingSearchResult as Place | undefined;
  const popupContent = createDiv({ cls: PopupClasses.container });

  renderSearchResult(popupContent, searchResult ?? {
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    website: '',
    tags: [],
    source: '',
    attribution: '',
  }, { compact: true });

  if (place.actions && onPlaceAction) {
    appendActionRows(popupContent, place.actions.map(action => ({
      label: action.label,
      checked: action.checked,
      onSelect: state => onPlaceAction(place, action.id, state),
    })), closePopup);
  }

  return popupContent;
}

export function appendGeoJsonProperties(container: HTMLElement, properties: GeoJSON.GeoJsonProperties, excludeKeys: Set<string>): void {
  if (!properties) return;

  const displayProperties = Object.entries(properties).filter(([key]) => !excludeKeys.has(key));
  if (displayProperties.length === 0) return;

  const propsDiv = container.createDiv({ cls: 'places-geojson-properties' });
  for (const [key, value] of displayProperties) {
    const propDiv = propsDiv.createDiv({ cls: 'places-geojson-property' });
    propDiv.createSpan({ text: `${key}: `, cls: 'places-geojson-property-key' });
    propDiv.createSpan({ text: String(value), cls: 'places-geojson-property-value' });
  }
}

export function getGeoJsonGeometryIcon(geometryType: string): string {
  const geometryIcons: Record<string, string> = {
    Point: '📍',
    LineString: '〰️',
    Polygon: '⬡',
    MultiPoint: '📍',
    MultiLineString: '〰️',
    MultiPolygon: '⬡',
    GeometryCollection: '📦'
  };
  return geometryIcons[geometryType] || '📍';
}

export interface GeoJsonFeaturePopupContentOptions {
  properties: GeoJSON.GeoJsonProperties;
  geometryType: string;
  sourcePath?: string;
  onSourceLinkClick?: (linkPath: string) => void;
  excludeKeys?: Set<string>;
}

const GEOJSON_LABEL_PROPERTY = '_placesLabel';

const ROUTE_ENDPOINT_POPUP_HIDDEN_KEYS = new Set([
  'name', 'title', 'Name', 'Title',
  'route_endpoint', 'route_endpoint_label', 'route_waypoint_index', 'route_endpoint_path', 'route_endpoint_icon',
  GENERATED_OVERLAY_PROPERTY,
  'marker-color', 'circle-radius', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
  '_isOverlayPoint', '_overlaySource', 'mapPlace',
]);

function isRouteEndpointFeature(properties: GeoJSON.GeoJsonProperties): boolean {
  return !!properties?.route_endpoint;
}

// Directions/isochrone features link only through their waypoint note (route endpoints).
function resolveFeatureLinkPath(properties: GeoJSON.GeoJsonProperties, sourcePath: string | undefined): string | undefined {
  if (isRouteEndpointFeature(properties)) return getRouteEndpointLinkPath(properties);
  if (properties?.[GENERATED_OVERLAY_PROPERTY]) return undefined;
  return sourcePath;
}

function getRouteEndpointLinkPath(properties: GeoJSON.GeoJsonProperties): string | undefined {
  const path: unknown = properties?.route_endpoint_path;
  return typeof path === 'string' && path ? path : undefined;
}

function getRouteEndpointIcon(properties: GeoJSON.GeoJsonProperties): string | undefined {
  const icon: unknown = properties?.route_endpoint_icon;
  return typeof icon === 'string' && icon ? icon : undefined;
}

function findFeaturePropertyString(properties: GeoJSON.GeoJsonProperties, names: string[]): string | undefined {
  if (!properties) return undefined;
  const targets = new Set(names.map((name) => name.toLowerCase()));
  for (const [key, value] of Object.entries(properties)) {
    if (targets.has(key.toLowerCase()) && typeof value === 'string' && value) return value;
  }
  return undefined;
}

export function buildGeoJsonFeaturePopupContent(options: GeoJsonFeaturePopupContentOptions): HTMLElement {
  const { properties, geometryType, sourcePath } = options;
  const isRouteEndpoint = isRouteEndpointFeature(properties);
  const renderedLabel: unknown = properties?.[GEOJSON_LABEL_PROPERTY];
  let featureName: string | undefined = typeof renderedLabel === 'string' && renderedLabel ? renderedLabel : undefined;
  featureName ??= findFeaturePropertyString(properties, ['name', 'title']);
  if (!featureName && sourcePath) {
    featureName = getFileNameWithoutExtension(sourcePath, geometryType, /\.md$/i);
  }
  const displayName = String(featureName || geometryType);

  const linkPath = resolveFeatureLinkPath(properties, sourcePath);

  const popupDiv = buildPopupContent({
    icon: (isRouteEndpoint ? getRouteEndpointIcon(properties) : undefined) ?? getGeoJsonGeometryIcon(geometryType),
    name: displayName,
    isLink: !!linkPath,
    linkPath,
    subtitle: !isRouteEndpoint && geometryType !== displayName ? geometryType : undefined,
    onLinkClick: options.onSourceLinkClick
  });

  appendGeoJsonProperties(popupDiv, properties, options.excludeKeys ?? (isRouteEndpoint ? ROUTE_ENDPOINT_POPUP_HIDDEN_KEYS : new Set(['name', 'title', 'Name', 'Title', GENERATED_OVERLAY_PROPERTY, GEOJSON_LABEL_PROPERTY])));
  return popupDiv;
}

export interface OverlayPointPopupContentOptions {
  properties: GeoJSON.GeoJsonProperties;
  sourcePath?: string;
  defaultName?: string;
  onSourceLinkClick?: (linkPath: string) => void;
}

export function createSourceLinkClickHandler(sourcePath: string | undefined, openInternalLink: (linkPath: string) => void): ((linkPath: string) => void) | undefined {
  if (!sourcePath) return undefined;

  return (linkPath) => {
    if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
      activeWindow.open(linkPath, '_blank', 'noopener,noreferrer');
    } else {
      openInternalLink(linkPath);
    }
  };
}

export function buildOverlayPointPopupContent(options: OverlayPointPopupContentOptions): HTMLElement {
  const { properties, sourcePath } = options;
  const isRouteEndpoint = isRouteEndpointFeature(properties);
  const isUrl = sourcePath?.startsWith('http://') || sourcePath?.startsWith('https://');
  let featureName: unknown = properties?.[GEOJSON_LABEL_PROPERTY] || properties?.name || properties?.title || properties?.Name || properties?.Title;

  if (!featureName && sourcePath) {
    if (isUrl) {
      try {
        const url = new URL(sourcePath);
        featureName = url.pathname.split('/').pop() || url.hostname;
      } catch {
        featureName = options.defaultName ?? 'Point';
      }
    } else {
      featureName = getFileNameWithoutExtension(sourcePath, options.defaultName || 'Point', /\.md$/i);
    }
  }
  const displayName = typeof featureName === 'string' && featureName ? featureName : options.defaultName || 'Point';

  const linkPath = resolveFeatureLinkPath(properties, sourcePath);

  const popupDiv = buildPopupContent({
    icon: (isRouteEndpoint ? getRouteEndpointIcon(properties) : undefined) ?? '📍',
    name: displayName,
    isLink: !!linkPath,
    linkPath,
    onLinkClick: options.onSourceLinkClick
  });

  appendGeoJsonProperties(popupDiv, properties, isRouteEndpoint ? ROUTE_ENDPOINT_POPUP_HIDDEN_KEYS : new Set(['name', 'title', 'Name', 'Title', '_isOverlayPoint', '_overlaySource', 'mapPlace', GENERATED_OVERLAY_PROPERTY, GEOJSON_LABEL_PROPERTY]));
  return popupDiv;
}

export interface WaypointPopupOptions {
  readonly place: MapPlace;
  readonly units: UnitsSystem;
  readonly onSourceLinkClick?: (linkPath: string) => void;
}

export function buildWaypointPopupContent(options: WaypointPopupOptions): HTMLElement {
  const { place, units } = options;
  const metadata = place.metadata ?? {};
  const div = createDiv({ cls: 'places-waypoint-popup' });

  const filePath = place.filePath;
  if (filePath) {
    const link = div.createEl('a', { text: getFileNameWithoutExtension(filePath, filePath, /\.md$/i), cls: 'internal-link' });
    link.href = filePath;
    link.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onSourceLinkClick?.(filePath);
    };
  }

  div.createDiv({ text: place.name, cls: 'places-waypoint-popup-name' });

  const description = scalarToString(metadata.waypointDescription);
  if (description) appendWaypointDescription(div, description);

  const type = scalarToString(metadata.waypointType);
  if (type) div.createDiv({ text: `Type: ${type}`, cls: 'places-waypoint-popup-type' });

  const elevation = metadata.waypointElevation;
  if (typeof elevation === 'number') {
    div.createDiv({ text: `Elevation: ${formatMetersInSystem(meters(elevation), units)}`, cls: 'places-waypoint-popup-elevation' });
  }

  const comment = scalarToString(metadata.waypointComment);
  if (comment) div.createDiv({ text: comment, cls: 'places-waypoint-popup-comment' });

  const externalLink = scalarToString(metadata.waypointLink);
  if (externalLink) {
    div.createEl('a', { text: 'Link', href: externalLink, cls: 'external-link places-waypoint-popup-link', attr: { target: '_blank', rel: 'noopener noreferrer' } });
  }

  return div;
}

function appendWaypointDescription(host: HTMLElement, rawDescription: string): void {
  const description = rawDescription.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
  const body = new DOMParser().parseFromString(description, 'text/html').body;
  const container = host.createDiv({ cls: 'places-waypoint-popup-description' });

  const paragraphs = [...body.querySelectorAll('p')];
  if (paragraphs.length === 0) {
    const text = body.textContent?.trim();
    if (text) container.createDiv({ text });
    return;
  }

  for (const paragraph of paragraphs) {
    const images = [...paragraph.querySelectorAll('img')];
    if (images.length === 0) {
      const text = paragraph.textContent?.trim();
      if (text) container.createEl('p', { text });
      continue;
    }

    const captions = [...paragraph.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim())
      .filter((text): text is string => Boolean(text));
    if (captions.length > 0) container.createEl('p', { text: captions.join(' ') });

    for (const image of images) {
      const source = image.getAttribute('src');
      if (!source) continue;
      const element = container.createEl('img', { cls: 'places-waypoint-popup-image', attr: { src: source } });
      const alt = image.getAttribute('alt');
      if (alt) element.setAttribute('alt', alt);
    }
  }
}
