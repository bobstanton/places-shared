import { Coordinate } from '../geo/DistanceCalculator';
import { parseCoordinate } from '../geo/CoordinateParser';
import { createDiv, createElement, emptyElement, setCssProperties } from './Dom';

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  if (typeof error === 'string') return error;

  return serializeUnknown(error) || 'Unknown error';
}

// FNV-1a string hash, base36. For change-detection fingerprints, not security.
export function fnvHash(text: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

export function fnvHash64(text: string): string {
  let low = 0x811c9dc5;
  let high = 0x84222325;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    low = Math.imul(low ^ code, 0x01000193);
    high = Math.imul(high ^ code, 0x000001b3);
  }

  return `${(low >>> 0).toString(36)}${(high >>> 0).toString(36)}`;
}

// djb2 string hash, base36. Not security. Output must stay byte-identical to
// the historical inline copies: route-overlay localStorage cache keys are
// built from it, and changing the algorithm orphans persisted entries.
export function hashString36(text: string): string {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  return Math.abs(hash).toString(36);
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);

  return Math.round(value * factor) / factor;
}

export function getError(error: unknown): Error {
  return error instanceof Error ? error : new Error(getErrorMessage(error));
}

// Obsidian's requestUrl has no timeout of its own.
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);

    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(getError(error)); }
    );
  });
}

// Exported through worker-safe.ts and executed inside the frequency-analysis
// worker (no `window`) and in plain Node by the places-tests verification
// scripts (no `self`). globalThis is the only host defined in all three;
// obsidianmd/no-global-this warns here, expected.
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Non-scalars (objects, arrays, functions, null, undefined) become ''.
export function coerceScalarString(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    default:
      return '';
  }
}

// Safe for arbitrarily large inputs, unlike Math.min(...values), which
// overflows the call stack past ~65k elements.
export function numericRange(values: Iterable<number>): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let hasValues = false;

  for (const value of values) {
    hasValues = true;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return hasValues ? { min, max } : null;
}

// Keep a wheel gesture inside `element`: the map never zooms under it and the
// note behind it never scrolls.
//
// `preventDefault` is what stops the note - stopPropagation cannot, because
// scroll chaining is the browser's default action rather than a listener - but
// it also cancels native scrolling inside the element (a popup's scrollable body).
export function preventWheelPropagation(element: HTMLElement): void {
  element.addEventListener('wheel', (e) => {
    e.stopPropagation();

    if (!canConsumeWheel(element, e.target, e.deltaY)) {
      e.preventDefault();
    }
  }, { passive: false });
}

function canConsumeWheel(boundary: HTMLElement, target: EventTarget | null, deltaY: number): boolean {
  if (deltaY === 0) return false;
  let node = target instanceof HTMLElement ? target : null;

  while (node) {
    const overflowY = node.ownerDocument.defaultView?.getComputedStyle(node).overflowY;

    if (overflowY === 'auto' || overflowY === 'scroll') {
      const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;

      if (deltaY > 0 ? remaining > 1 : node.scrollTop > 0) return true;
    }

    if (node === boundary) return false;
    node = node.parentElement;
  }

  return false;
}

// Local copy: obsidian's normalizePath cannot load in workers.
export function normalizePath(path: string): string {
  let normalized = path.replace(/\\/g, '/');

  normalized = normalized.replace(/\/+/g, '/');

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

// Format a coordinate for display and for the `Location` frontmatter every
// note-writing path produces (e.g., "40.748333, -73.985556"). Six decimals is
// ~11cm, matching the precision stored track geometry is compacted to.
// For cache keys, use formatCoordinate() from CacheTypes instead (no space, coarser).
export function formatDisplayCoordinate(coordinate: Coordinate, precision: number = 6): string {
  return `${coordinate.latitude.toFixed(precision)}, ${coordinate.longitude.toFixed(precision)}`;
}

export function getFileNameWithoutExtension(path: string | null | undefined, fallback = '', extensionPattern: RegExp = /\.[^./\\]+$/): string {
  if (!path) return fallback;
  const fileName = path.replace(/\\/g, '/').split('/').pop()?.replace(extensionPattern, '');

  return fileName || fallback;
}

export interface ErrorOptions {
  // Icon to display before the title (e.g., "📍", "🔌", "⚠️")
  icon?: string;
  title: string;
  message?: string;
  // Class suffix, prefixed with "places-".
  className?: string;
}

export interface ErrorHelpSection {
  type: string;
  title: string;
  items?: string[];
  code?: string;
}

export interface ErrorWithHelpOptions extends ErrorOptions {
  // Plain text help below the error.
  help?: string;
  // Structured help sections below the error.
  helpSections?: ErrorHelpSection[];
}

export function renderError(container: HTMLElement, options: ErrorOptions): HTMLElement {
  const classes = ['places-error'];

  if (options.className) {
    classes.push('places-' + options.className);
  }

  const errorDiv = createDiv(container, { cls: classes.join(' ') });
  const titleText = options.icon ? `${options.icon} ${options.title}` : options.title;

  createElement(errorDiv, 'h3', { text: titleText });

  if (options.message) {
    createElement(errorDiv, 'p', { text: options.message });
  }

  return errorDiv;
}

export function renderErrorWithHelp(container: HTMLElement, options: ErrorWithHelpOptions): HTMLElement {
  const errorElement = renderError(container, options);

  if (options.help) {
    createElement(errorElement, 'pre', { text: options.help, cls: "places-error-help" });
  }

  if (options.helpSections && options.helpSections.length > 0) {
    renderStructuredErrorHelp(errorElement, options.helpSections);
  }

  return errorElement;
}

export function renderMapSurfaceError(container: HTMLElement, options: ErrorWithHelpOptions): HTMLElement {
  emptyElement(container);
  container.classList.add('places-map-surface-error');
  container.style.removeProperty('--places-map-height');
  setCssProperties(container, {
    height: 'auto',
    minHeight: '0',
  });

  return renderErrorWithHelp(container, options);
}

// Renders beside (not inside) the fixed-height map, for failures that leave
// the map useful (one failed overlay).
export function renderMapSupplementalError(container: HTMLElement, options: ErrorWithHelpOptions): HTMLElement {
  const host = container.parentElement ?? container;

  return renderErrorWithHelp(host, {
    ...options,
    className: [options.className, 'map-supplemental-error', 'places-error-below-map'].filter(Boolean).join(' '),
  });
}

function renderStructuredErrorHelp(container: HTMLElement, sections: ErrorHelpSection[]): void {
  const helpContainer = createDiv(container, { cls: "places-error-help-structured" });

  for (const section of sections) {
    const sectionEl = createDiv(helpContainer, { cls: "places-help-section" });

    createElement(sectionEl, 'strong', { text: section.title });

    if (section.type === 'text' && section.items) {
      const list = createElement(sectionEl, 'ul');

      for (const item of section.items) {
        createElement(list, 'li', { text: item });
      }
    } else if (section.type === 'sql' && section.code) {
      const pre = createElement(sectionEl, 'pre', { cls: "places-sql-example" });

      createElement(pre, 'code', { text: section.code, cls: "language-sql" });
    }
  }
}

const MAX_FILENAME_LENGTH = 160;

export class Utilities {
  public static applyDefaults(extensionSettings: Record<string, string>, defaults: Record<string, string>): void {
    for (const key in defaults) {
      if (!(key in extensionSettings)) {
        extensionSettings[key] = defaults[key];
      }
    }
  }

  // `location` is a "lat, lng" string.
  public static parseLocationString(location: string): Coordinate | null {
    return parseCoordinate(location);
  }

  public static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[/\\?%*:|"<>]/g, "-")
      .replace(/\(\)/g, "")
      .trim()
      // Leaves room for a folder path and a " (2)" suffix inside the
      // filesystem limit.
      .slice(0, MAX_FILENAME_LENGTH)
      .trim();
  }

  public static formatDuration(durationSeconds: number, includeSeconds: boolean = true, padHours: boolean = true): string {
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = Math.floor(durationSeconds % 60);

    const hoursStr = padHours ? hours.toString().padStart(2, '0') : hours.toString();
    const minutesStr = minutes.toString().padStart(2, '0');

    if (includeSeconds) {
      const secondsStr = seconds.toString().padStart(2, '0');

      return `${hoursStr}:${minutesStr}:${secondsStr}`;
    } else {
      return `${hoursStr}:${minutesStr}`;
    }
  }

  public static formatDateAsYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}${month}${day}`;
  }

  public static isDataviewUnavailableError(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === 'object' && 'message' in error) {
      return (error as Error).message === PLUGIN_ERRORS.DATAVIEW;
    }

    return false;
  }

  public static isVaultQueryUnavailableError(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === 'object' && 'message' in error) {
      const message = (error as Error).message;

      return typeof message === 'string' && (
        message.includes(PLUGIN_ERRORS.VAULTQUERY) ||
        message.includes("VaultQuery API not available")
      );
    }

    return false;
  }
}

export const PLUGIN_ERRORS = {
  DATAVIEW: "Dataview plugin is not available",
  VAULTQUERY: "VaultQuery plugin is not available"
} as const;

// MapLibre/Mapbox serialize feature properties to JSON strings. Returns [] on
// parse failure.
export function parseContributingFiles(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function removeRedundantPlaceAddressParts(place: { name: string; address: string; country: string }): void {
  if (place.address.startsWith(place.name)) {
    place.address = place.address.substring(place.name.length + 2);
  }

  if (place.address.endsWith(place.country)) {
    place.address = place.address.substring(0, place.address.length - place.country.length - 2);
  }
}

export const MapConstants = {
  CLUSTER_MAX_ZOOM: 17,

  CLICK_PROXIMITY_THRESHOLD_PX: 50,

  CLUSTER_SIZES: {
    SMALL: { threshold: 0, radius: 20 },
    MEDIUM: { threshold: 100, radius: 30 },
    LARGE: { threshold: 750, radius: 40 }
  },

  CLUSTER_COLORS: {
    SMALL: '#51bbd6',
    MEDIUM: '#f1f075',
    LARGE: '#f28cb1'
  }
} as const;

// Objects and collections become the fallback.
export function scalarToString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);

  return fallback;
}

// Never falls back to JavaScript's "[object Object]" text.
export function serializeUnknown(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'object') return scalarToString(value, fallback);

  try {
    return JSON.stringify(value) ?? fallback;
  } catch {
    return fallback;
  }
}

// The spelling rule for property names, shared by code-block keys, note
// frontmatter, SQL result columns, and style-condition fields: separators and
// case are insignificant: `Track Color By`, `trackColorBy`, `track_color_by`
// and `track-color-by` are one key. VaultQuery columns arrive lowercased.
export function normalizePropertyName(key: string): string {
  return key.replace(/[\s_-]+/g, '').toLowerCase();
}

export function readNormalizedProperty(source: Record<string, unknown> | undefined, key: string): unknown {
  if (!source) return undefined;
  const wanted = normalizePropertyName(key);

  for (const [candidate, value] of Object.entries(source)) {
    if (normalizePropertyName(candidate) === wanted && value != null) return value;
  }

  return undefined;
}
