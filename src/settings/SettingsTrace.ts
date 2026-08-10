// Settings-resolution tracing for the `debug: settings` block mode: given the
// ordered layers a block merges (defaults, global settings, provider settings,
// block source, ...) and the final resolved settings, produce a per-key table
// of what each layer supplied and which value won.
//
// Provenance is reconstructed by comparison, not recorded during parsing: the
// winner is the right-most layer that defines the key. When the resolved value
// differs from the winning layer's raw value (clamping, unit conversion, enum
// fallback), the row is marked derived and shows both.

import { coerceScalarString } from '../utils/Utilities';

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
  // Keys to leave out. Defaults to internal keys (leading underscore).
  exclude?: (key: string) => boolean;
  // Notes per key, shown in the trace (e.g., clustering decision reason).
  notes?: Record<string, string>;
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

  return { layers: layers.map(layer => layer.name), rows };
}

// Render the trace as a GitHub-flavored markdown table.
export function settingsTraceToMarkdown(trace: SettingsTrace): string {
  const escape = (text: string) => text.replace(/\|/g, '\\|');
  const header = ['Setting', ...trace.layers, 'Resolved', 'Source'];
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];
  for (const row of trace.rows) {
    const cells = [
      row.key,
      ...row.layerValues,
      row.resolved,
      row.note ? `${row.source} - ${row.note}` : row.source,
    ];
    lines.push(`| ${cells.map(escape).join(' | ')} |`);
  }
  return lines.join('\n');
}
