import { parseMapConfigPatch } from './MapConfigResolver';
import type { MapConfigPatch } from './MapConfiguration';
import { normalizePropertyName } from '../utils/Utilities';
import { isRecord } from '../utils/ValueGuards';
import { STYLE_RULE_KEYS } from './StyleRuleKeys';
import { mergePopupContentConfig } from './PopupConfiguration';

export const PLACE_SETTINGS_KEYS = [
  'labelTemplate', 'iconRotation', 'iconImage', 'iconStyles', 'iconImageStyles', 'labelStyles', 'popup',
  'markerMinZoom', 'markerMaxZoom', 'labelMinZoom', 'labelMaxZoom',
  'trackMinZoom', 'trackMaxZoom', 'overlayMinZoom', 'overlayMaxZoom', 'track',
] as const;

const TRACK_KEYS = ['colorBy', 'defaultVisibility', 'outline', 'style', 'labels'] as const;
const LABEL_KEYS = ['visibility', 'start', 'midpoint', 'end'] as const;

export const PLACE_SETTINGS_PATHS: readonly string[] = [
  ...PLACE_SETTINGS_KEYS.filter(key => key !== 'track' && key !== 'popup'),
  ...TRACK_KEYS.filter(key => key !== 'labels').map(key => `track.${key}`),
  ...LABEL_KEYS.map(key => `track.labels.${key}`),
  'popup.content', 'popup.content.renderer',
  'popup.content.options', 'popup.content.options.templateFile',
];
const COLUMN_PATH_BY_NAME = new Map(PLACE_SETTINGS_PATHS.map(path => [normalizePropertyName(path), path]));

const RULE_LIST_PATHS: Record<string, string> = { iconstyles: 'iconStyles', iconimagestyles: 'iconImageStyles', labelstyles: 'labelStyles' };

export interface PlaceSettingsLayer {
  source: 'query' | 'note';
  values: MapConfigPatch;
}

export function parsePlaceSettings(row: Readonly<Record<string, unknown>> | undefined, source: 'note' | 'query'): MapConfigPatch {
  const fieldKind = source === 'note' ? 'Note property' : 'Query column';
  const columns = new Map<string, { name: string; value: unknown }>();

  for (const [name, value] of Object.entries(row ?? {})) {
    if (value == null) continue;
    const normalized = normalizePropertyName(name);
    let path = COLUMN_PATH_BY_NAME.get(normalized);

    if (normalized === 'popup') {
      if (!isRecord(value)) continue;
      path = 'popup';
    }

    if (!path) {
      const list = normalized.match(/^(iconstyles|iconimagestyles|labelstyles)\.(0|[1-9]\d*)$/);
      const popup = normalized.match(/^popup\.content\.(0|[1-9]\d*)(?:\.(renderer))?$/);
      const options = normalized.match(/^popup\.content(?:\.(0|[1-9]\d*))?\.options(?:\..+)?$/);

      if (list) path = `${RULE_LIST_PATHS[list[1]]}.${list[2]}`;
      else if (popup) path = `popup.content.${popup[1]}${popup[2] ? `.${popup[2]}` : ''}`;
      else if (options) {
        const parts = name.split('.').slice(options[1] === undefined ? 3 : 4);

        if (parts.some(part => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part) || ['__proto__', 'prototype', 'constructor'].includes(part))) {
          throw new Error(`${fieldKind} "${name}" has an invalid option name.`);
        }

        path = `popup.content.${options[1] === undefined ? '' : `${options[1]}.`}options${parts.length ? `.${parts.join('.')}` : ''}`;
      }
      else continue;
    }

    const parsedValue = path === 'track.outline' && (value === 0 || value === 1) ? Boolean(value) : value;
    const previous = columns.get(path);

    if (previous && JSON.stringify(previous.value) !== JSON.stringify(parsedValue)) {
      throw new Error(`Conflicting settings "${previous.name}" and "${name}" set ${path}. Keep one value.`);
    }

    columns.set(path, { name, value: parsedValue });
  }

  const settings: Record<string, unknown> = {};
  const ordered = [...columns].sort(([a], [b]) => a.split('.').length - b.split('.').length);
  const assigned = new Set<string>();

  for (const [path, { value }] of ordered) {
    const parts = path.split('.');

    if (parts.some(part => /^\d+$/.test(part) && (!Number.isSafeInteger(Number(part)) || Number(part) >= 4294967295))) {
      throw new Error(`${fieldKind} "${path}" has an invalid list index.`);
    }

    let target: Record<string, unknown> = settings;

    for (let index = 0; index < parts.length - 1; index++) {
      const prefix = parts.slice(0, index + 1).join('.');

      if (assigned.has(prefix)) throw new Error(`Conflicting settings "${prefix}" and "${path}". Set "${prefix}" or the settings under it, not both.`);
      const key = parts[index];
      const nextIsIndex = /^\d+$/.test(parts[index + 1]);
      const child = target[key];

      if (child === undefined) target[key] = nextIsIndex ? [] : {};
      else if (Array.isArray(child) !== nextIsIndex) throw new Error(`Conflicting setting paths under "${prefix}". Use one popup content structure.`);

      target = target[key] as Record<string, unknown>;
    }

    const key = parts[parts.length - 1];

    target[key] = value;
    assigned.add(path);
  }

  return parseMapConfigPatch(compactColumnLists(settings) as Record<string, unknown>);
}

function compactColumnLists(value: unknown, path = ''): unknown {
  if (Array.isArray(value)) {
    const entries = path === 'popup.content' ? value : Object.values(value);

    return entries.map(entry => compactColumnLists(entry));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, compactColumnLists(entry, path ? `${path}.${key}` : key)]));
  }

  return value;
}

export function mergePlaceSettings(layers: readonly Pick<PlaceSettingsLayer, 'values'>[]): MapConfigPatch {
  const result: Record<string, unknown> = {};

  for (const { values } of layers) {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue;

      if (key === 'popup') result.popup = mergePopupContentConfig(result.popup as MapConfigPatch['popup'], values.popup);
      else if (STYLE_RULE_KEYS.has(key)) {
        const rules = (entry: unknown): readonly unknown[] => Array.isArray(entry) ? entry : entry === undefined ? [] : [entry];

        result[key] = [...rules(result[key]), ...rules(value)];
      } else result[key] = value;
    }
  }

  return result;
}
