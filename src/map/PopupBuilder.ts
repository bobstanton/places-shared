import { getFileNameWithoutExtension, preventWheelPropagation, scalarToString } from "../utils/Utilities";
import { formatMetersInSystem, meters, type UnitsSystem } from "../Units";
import type * as GeoJSON from "geojson";
import { PlaceAction, MapPlace, Place } from "../Place";
import { renderSearchResult } from "./SearchResultRenderer";
import { GENERATED_OVERLAY_PROPERTY } from "../services/RouteOverlayGeoJson";
import { OVERLAY_RENDER_BAND_PROPERTY } from "../overlay/OverlaySystem";
import { createDiv, createElement, createSpan } from "../utils/Dom";
import { isVaultPath, REMOTE_URL } from "../utils/VaultPath";
import { sharedRegistryValue } from "../utils/CrossBundleRegistry";
import type { ResolvedPopupField } from './PopupContent';
import { WAYPOINT_ICON_PROPERTY } from './WaypointIcon';

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

const DEVICE_PATHS_KEY = Symbol.for('places.device.paths.openable');

function devicePaths(): { openable: boolean } {
  return sharedRegistryValue<{ openable: boolean }>(DEVICE_PATHS_KEY, () => ({ openable: false }));
}

export function setDevicePathsOpenable(openable: boolean): void {
  devicePaths().openable = openable;
}

export function isOpenableLink(linkTarget: string): boolean {
  return isVaultPath(linkTarget) || REMOTE_URL.test(linkTarget.trim()) || devicePaths().openable;
}

export function popupLinkClass(linkTarget: string): string {
  return isVaultPath(linkTarget) ? 'internal-link' : 'external-link';
}

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

  const actionsDiv = createDiv(container, { cls: PopupClasses.actions });

  for (const row of rows) {
    if (row.checked !== undefined) {
      const item = createElement(actionsDiv, 'label', { cls: `${PopupClasses.actionItem} places-popup-action-toggle` });
      const checkbox = createElement(item, 'input', { type: 'checkbox' });

      checkbox.checked = row.checked;
      checkbox.addEventListener('change', () => row.onSelect({ checked: checkbox.checked }));
      createSpan(item, { text: row.label });
      continue;
    }

    const item = createDiv(actionsDiv, { cls: PopupClasses.actionItem });
    const emojiMatch = row.icon ? null : row.label.match(LEADING_EMOJI_PATTERN);

    if (row.icon) {
      createSpan(item, { text: row.icon, cls: PopupClasses.actionIcon });
      createSpan(item, { text: row.label });
    } else if (emojiMatch) {
      createSpan(item, { text: emojiMatch[1], cls: PopupClasses.actionIcon });
      createSpan(item, { text: row.label.slice(emojiMatch[0].length) });
    } else {
      createSpan(item, { text: row.label });
    }

    item.onclick = () => {
      row.onSelect({});
      if (!row.keepOpen) closePopup?.();
    };
  }
}

export function appendPlaceSection(container: HTMLElement, options: PopupOptions): void {
  const header = createDiv(container, { cls: PopupClasses.header });

  if (options.icon) {
    createSpan(header, { text: options.icon, cls: PopupClasses.icon });
  }

  if (options.isLink && isOpenableLink(options.linkPath || options.name)) {
    const linkTarget = options.linkPath || options.name;
    const linkEl = createElement(header, 'a', {
      text: options.name,
      href: linkTarget,
      cls: `${popupLinkClass(linkTarget)} ${PopupClasses.name}`
    });

    if (options.onLinkClick) {
      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        options.onLinkClick!(linkTarget);
      });
    }
  } else {
    createSpan(header, { text: options.name, cls: PopupClasses.name });
  }

  if (options.subtitle) {
    createDiv(container, { text: options.subtitle, cls: PopupClasses.subtitle });
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
  const container = createDiv(null, { cls: `${PopupClasses.container} places-popup-multi` });

  preventWheelPropagation(container);

  createDiv(container, { text: options.title, cls: 'places-popup-multi-title' });

  for (const place of options.places) {
    appendPlaceSection(createDiv(container, { cls: 'places-popup-multi-place' }), place);
  }

  return container;
}

export interface PopupPageEntry {
  readonly label: string;
  readonly icon?: string;
  readonly kind: string;
}

export interface PagedPopupOptions {
  readonly pages: readonly PopupPageEntry[];
  readonly onShow: (index: number, host: HTMLElement, root: HTMLElement) => void | (() => void);
}

export interface PagedPopup {
  readonly element: HTMLElement;
  readonly index: number;
  show(index: number): void;
  dispose(): void;
}

export function buildPagedPopupContent(options: PagedPopupOptions): PagedPopup {
  const container = createDiv(null, { cls: `${PopupClasses.container} places-popup-paged` });

  preventWheelPropagation(container);

  const pager = createDiv(container, { cls: 'places-popup-pager' });
  const previous = createElement(pager, 'button', { cls: 'places-popup-pager-step', text: '‹', attr: { 'aria-label': 'Previous item' } });
  const counter = createElement(pager, 'button', { cls: 'places-popup-pager-counter', attr: { 'aria-label': 'Show every item here' } });
  const next = createElement(pager, 'button', { cls: 'places-popup-pager-step', text: '›', attr: { 'aria-label': 'Next item' } });
  const page = createDiv(container, { cls: 'places-popup-page' });

  const paged: { index: number } = { index: 0 };
  let cleanup: (() => void) | void;
  let disposed = false;
  const leavePage = (): void => {
    const previousCleanup = cleanup;

    cleanup = undefined;
    previousCleanup?.();
  };
  const show = (index: number): void => {
    if (disposed) return;
    leavePage();
    paged.index = Math.max(0, Math.min(index, options.pages.length - 1));
    counter.textContent = `${paged.index + 1}/${options.pages.length}`;
    previous.disabled = paged.index === 0;
    next.disabled = paged.index === options.pages.length - 1;
    page.replaceChildren();
    cleanup = options.onShow(paged.index, page, container);
  };

  previous.addEventListener('click', () => show(paged.index - 1));
  next.addEventListener('click', () => show(paged.index + 1));
  counter.addEventListener('click', () => {
    if (disposed) return;
    leavePage();
    page.replaceChildren();
    const list = createDiv(page, { cls: 'places-popup-page-list' });

    options.pages.forEach((entry, index) => {
      const row = createDiv(list, { cls: `places-context-menu-item places-popup-page-row${index === paged.index ? ' is-active' : ''}` });

      if (entry.icon) createSpan(row, { text: entry.icon, cls: PopupClasses.actionIcon });
      createSpan(row, { text: entry.label, cls: 'places-popup-page-label' });
      createSpan(row, { text: entry.kind, cls: 'places-popup-page-kind' });
      row.addEventListener('click', () => show(index));
    });
  });

  show(0);

  return {
    element: container,
    get index() { return paged.index; },
    show,
    dispose: () => { disposed = true; leavePage(); },
  };
}

export function buildPopupContent(options: PopupOptions): HTMLElement {
  const container = createDiv(null, { cls: PopupClasses.container });

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

export function appendPopupDebugSection(container: HTMLElement, debug: PopupDebugInfo): void {
  const details = createElement(container, 'details', { cls: 'places-popup-debug' });

  createElement(details, 'summary', { text: 'Debug: fields & filters' });

  if (debug.filterRules.length > 0) {
    const rules = createDiv(details, { cls: 'places-popup-debug-rules' });

    for (const entry of debug.filterRules) {
      const row = createDiv(rules, { cls: 'places-popup-debug-rule' });

      createSpan(row, {
        cls: entry.valid ? (entry.matched ? 'places-popup-debug-match' : 'places-popup-debug-miss') : 'places-popup-debug-invalid',
        text: entry.valid ? (entry.matched ? '✓' : '✕') : '⚠',
      });
      createElement(row, 'code', { text: entry.rule });
    }
  }

  if (debug.fields.length === 0) {
    createDiv(details, { cls: 'places-popup-debug-empty', text: 'No metadata fields on this place.' });

    return;
  }

  const table = createElement(details, 'table', { cls: 'places-popup-debug-fields' });

  for (const { field, value } of debug.fields) {
    const row = createElement(table, 'tr');

    createElement(row, 'td', { text: field });
    createElement(row, 'td', { text: value });
  }
}

export function buildGeocodingSearchPopupContent(place: MapPlace, onPlaceAction?: (place: MapPlace, actionId: string, state: { checked?: boolean }) => void, closePopup?: () => void): HTMLElement {
  const searchResult = place.metadata?.geocodingSearchResult as Place | undefined;
  const popupContent = createDiv(null, { cls: PopupClasses.container });

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

  const propsDiv = createDiv(container, { cls: 'places-geojson-properties' });

  for (const [key, value] of displayProperties) {
    const propDiv = createDiv(propsDiv, { cls: 'places-geojson-property' });

    createSpan(propDiv, { text: `${key}: `, cls: 'places-geojson-property-key' });
    createSpan(propDiv, { text: String(value), cls: 'places-geojson-property-value' });
  }
}

export function appendPopupFields(container: HTMLElement, fields: readonly ResolvedPopupField[]): void {
  if (fields.length === 0) return;
  const fieldsDiv = createDiv(container, { cls: 'places-popup-fields places-geojson-properties' });

  for (const field of fields) {
    const row = createDiv(fieldsDiv, { cls: 'places-geojson-property' });

    createSpan(row, { text: `${field.label}: `, cls: 'places-geojson-property-key' });
    createSpan(row, { text: field.value, cls: 'places-geojson-property-value' });
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
  includeProperties?: boolean;
}

const GEOJSON_LABEL_PROPERTY = '_placesLabel';

const ROUTE_ENDPOINT_POPUP_HIDDEN_KEYS = new Set([
  'name', 'title', 'Name', 'Title',
  'route_endpoint', 'route_endpoint_label', 'route_waypoint_index', 'route_endpoint_path', 'route_endpoint_icon',
  GENERATED_OVERLAY_PROPERTY,
  OVERLAY_RENDER_BAND_PROPERTY,
  'marker-color', 'circle-radius', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
  '_isOverlayPoint', '_overlaySource', 'mapPlace',
  WAYPOINT_ICON_PROPERTY,
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

  if (options.includeProperties !== false) {
    appendDefaultGeoJsonProperties(popupDiv, properties, 'feature', options.excludeKeys);
  }

  return popupDiv;
}

export interface OverlayPointPopupContentOptions {
  properties: GeoJSON.GeoJsonProperties;
  sourcePath?: string;
  defaultName?: string;
  onSourceLinkClick?: (linkPath: string) => void;
  includeProperties?: boolean;
}

export function createSourceLinkClickHandler(sourcePath: string | undefined, openInternalLink: (linkPath: string) => void): ((linkPath: string) => void) | undefined {
  if (!sourcePath) return undefined;

  return (linkPath) => {
    if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
      window.open(linkPath, '_blank', 'noopener,noreferrer');
    } else {
      openInternalLink(linkPath);
    }
  };
}

export function resolveOverlayPointName(properties: GeoJSON.GeoJsonProperties, sourcePath?: string, defaultName = 'Point'): string {
  const featureName: unknown = properties?.[GEOJSON_LABEL_PROPERTY] || properties?.name || properties?.title || properties?.Name || properties?.Title;

  if (typeof featureName === 'string' && featureName) return featureName;

  if (sourcePath) {
    if (sourcePath.startsWith('http://') || sourcePath.startsWith('https://')) {
      try {
        const url = new URL(sourcePath);

        return url.pathname.split('/').pop() || url.hostname;
      } catch {
        return defaultName;
      }
    }

    return getFileNameWithoutExtension(sourcePath, defaultName, /\.md$/i);
  }

  return defaultName;
}

export function resolveOverlayPointIcon(properties: GeoJSON.GeoJsonProperties): string {
  const mappedWaypointIcon: unknown = properties?.[WAYPOINT_ICON_PROPERTY];

  return (isRouteEndpointFeature(properties) ? getRouteEndpointIcon(properties) : undefined)
    ?? (typeof mappedWaypointIcon === 'string' && mappedWaypointIcon ? mappedWaypointIcon : undefined)
    ?? '📍';
}

export function buildOverlayPointPopupContent(options: OverlayPointPopupContentOptions): HTMLElement {
  const { properties, sourcePath } = options;
  const displayName = resolveOverlayPointName(properties, sourcePath, options.defaultName ?? 'Point');
  const linkPath = resolveFeatureLinkPath(properties, sourcePath);

  const popupDiv = buildPopupContent({
    icon: resolveOverlayPointIcon(properties),
    name: displayName,
    isLink: !!linkPath,
    linkPath,
    onLinkClick: options.onSourceLinkClick
  });

  if (options.includeProperties !== false) {
    appendDefaultGeoJsonProperties(popupDiv, properties, 'point');
  }

  return popupDiv;
}

export function appendDefaultGeoJsonProperties(container: HTMLElement, properties: GeoJSON.GeoJsonProperties, presentation: 'feature' | 'point', excludeKeys?: Set<string>): void {
  const isRouteEndpoint = isRouteEndpointFeature(properties);
  const defaults = presentation === 'point'
    ? new Set(['name', 'title', 'Name', 'Title', '_isOverlayPoint', '_overlaySource', 'mapPlace', GENERATED_OVERLAY_PROPERTY, OVERLAY_RENDER_BAND_PROPERTY, GEOJSON_LABEL_PROPERTY, WAYPOINT_ICON_PROPERTY])
    : new Set(['name', 'title', 'Name', 'Title', GENERATED_OVERLAY_PROPERTY, OVERLAY_RENDER_BAND_PROPERTY, GEOJSON_LABEL_PROPERTY]);

  appendGeoJsonProperties(container, properties, excludeKeys ?? (isRouteEndpoint ? ROUTE_ENDPOINT_POPUP_HIDDEN_KEYS : defaults));
}

export interface WaypointPopupOptions {
  readonly place: MapPlace;
  readonly units: UnitsSystem;
  readonly onSourceLinkClick?: (linkPath: string) => void;
}

export function buildWaypointPopupContent(options: WaypointPopupOptions): HTMLElement {
  const { place, units } = options;
  const metadata = place.metadata ?? {};
  const div = createDiv(null, { cls: 'places-waypoint-popup' });

  const filePath = place.filePath;

  if (filePath) {
    const label = getFileNameWithoutExtension(filePath, filePath, /\.md$/i);

    if (!isOpenableLink(filePath)) {
      createDiv(div, { text: label });
    } else {
      const link = createElement(div, 'a', { text: label, cls: popupLinkClass(filePath) });

      link.href = filePath;

      link.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onSourceLinkClick?.(filePath);
      };
    }
  }

  createDiv(div, { text: place.name, cls: 'places-waypoint-popup-name' });

  const description = scalarToString(metadata.waypointDescription);

  if (description) appendWaypointDescription(div, description);

  const type = scalarToString(metadata.waypointType);

  if (type) createDiv(div, { text: `Type: ${type}`, cls: 'places-waypoint-popup-type' });

  const elevation = metadata.waypointElevation;

  if (typeof elevation === 'number') {
    createDiv(div, { text: `Elevation: ${formatMetersInSystem(meters(elevation), units)}`, cls: 'places-waypoint-popup-elevation' });
  }

  const comment = scalarToString(metadata.waypointComment);

  if (comment) createDiv(div, { text: comment, cls: 'places-waypoint-popup-comment' });

  const externalLink = scalarToString(metadata.waypointLink);

  if (externalLink) {
    createElement(div, 'a', { text: 'Link', href: externalLink, cls: 'external-link places-waypoint-popup-link', attr: { target: '_blank', rel: 'noopener noreferrer' } });
  }

  return div;
}

function appendWaypointDescription(host: HTMLElement, rawDescription: string): void {
  const description = rawDescription.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
  const body = new DOMParser().parseFromString(description, 'text/html').body;
  const container = createDiv(host, { cls: 'places-waypoint-popup-description' });

  const paragraphs = [...body.querySelectorAll('p')];

  if (paragraphs.length === 0) {
    const text = body.textContent?.trim();

    if (text) createDiv(container, { text });

    return;
  }

  for (const paragraph of paragraphs) {
    const images = [...paragraph.querySelectorAll('img')];

    if (images.length === 0) {
      const text = paragraph.textContent?.trim();

      if (text) createElement(container, 'p', { text });
      continue;
    }

    const captions = [...paragraph.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim())
      .filter((text): text is string => Boolean(text));

    if (captions.length > 0) createElement(container, 'p', { text: captions.join(' ') });

    for (const image of images) {
      const source = image.getAttribute('src');

      if (!source) continue;
      const element = createElement(container, 'img', { cls: 'places-waypoint-popup-image', attr: { src: source } });
      const alt = image.getAttribute('alt');

      if (alt) element.setAttribute('alt', alt);
    }
  }
}
