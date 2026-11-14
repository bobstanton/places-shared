import { coerceScalarString } from '../utils/index';

export interface SettingsTraceLayer {
  // Column heading (e.g., "Default", "Global", "Block").
  name: string;
  values: Record<string, unknown>;
}

export interface SettingsTraceRow {
  key: string;
  // One formatted value per layer, aligned with SettingsTrace.layers. Empty string = not set.
  layerValues: string[];
  resolved: string;
  // Index into SettingsTrace.layers for the layer that supplied the winning value. -1 for unset/derived-only rows.
  winnerLayerIndex: number;
  // Winning layer name, "derived", or "(unset)".
  source: string;
  // Extra context (e.g., why a derived value was computed).
  note?: string;
}

export interface SettingsTrace {
  layers: string[];
  rows: SettingsTraceRow[];
}

export interface BuildSettingsTraceOptions {
  exclude?: (key: string) => boolean;
  notes?: Record<string, string>;
  ignored?: Readonly<Record<string, unknown>>;
}

const VALUE_MAX_LENGTH = 60;

// Compact, table-safe rendering of any settings value.
export function formatTraceValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';

  if (Array.isArray(value)) {
    const joined = value.map(item => (typeof item === 'object' ? '{...}' : String(item))).join(', ');

    return truncate(`[${joined}]`);
  }

  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'function') return '(function)';
  if (typeof value === 'object') return truncate(JSON.stringify(value) ?? '{...}');

  return truncate(coerceScalarString(value));
}

function truncate(text: string): string {
  return text.length > VALUE_MAX_LENGTH ? `${text.slice(0, VALUE_MAX_LENGTH - 3)}...` : text;
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function buildSettingsTrace(layers: SettingsTraceLayer[], resolved: Record<string, unknown>, options?: BuildSettingsTraceOptions): SettingsTrace {
  const exclude = options?.exclude ?? ((key: string) => key.startsWith('_'));

  const keys = new Set<string>();

  for (const layer of layers) {
    for (const key of Object.keys(layer.values)) keys.add(key);
  }

  for (const key of Object.keys(resolved)) keys.add(key);

  const rows: SettingsTraceRow[] = [];

  for (const key of [...keys].sort()) {
    if (exclude(key)) continue;

    const resolvedValue = resolved[key];

    if (typeof resolvedValue === 'function') continue;

    const layerValues = layers.map(layer => formatTraceValue(layer.values[key]));
    const resolvedFormatted = formatTraceValue(resolvedValue);

    if (layerValues.every(value => value === '') && resolvedFormatted === '') continue;

    let winnerIndex = -1;

    for (let i = layers.length - 1; i >= 0; i--) {
      if (isSet(layers[i].values[key])) {
        winnerIndex = i;
        break;
      }
    }

    let source: string;

    if (!isSet(resolvedValue)) {
      source = '(unset)';
    } else if (winnerIndex === -1) {
      source = 'derived';
    } else if (layerValues[winnerIndex] === resolvedFormatted) {
      source = layers[winnerIndex].name;
    } else {
      source = `${layers[winnerIndex].name} (derived)`;
    }

    rows.push({ key, layerValues, resolved: resolvedFormatted, winnerLayerIndex: winnerIndex, source, note: options?.notes?.[key] });
  }

  for (const [key, value] of Object.entries(options?.ignored ?? {})) {
    rows.push({
      key,
      layerValues: layers.map(layer => layer.name === 'Block' ? formatTraceValue(value) : ''),
      resolved: '', winnerLayerIndex: -1, source: 'ignored',
      note: 'Not used at this location',
    });
  }

  return { layers: layers.map(layer => layer.name), rows };
}

export function settingsTraceToMarkdown(trace: SettingsTrace): string {
  const rows = [
    ['Setting', ...trace.layers, 'Resolved', 'Source'],
    ...trace.rows.map(row => [row.key, ...row.layerValues, row.resolved, row.note ? `${row.source} - ${row.note}` : row.source]),
  ].map(cells => cells.map(text => text.replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>')));
  const widths = rows[0].map((_, column) => Math.max(3, ...rows.map(row => row[column].length)));

  rows.splice(1, 0, widths.map(width => '-'.repeat(width)));

  return rows.map(cells => `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`).join('\n');
}
