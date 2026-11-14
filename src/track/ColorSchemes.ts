import type { Meters } from '../Units';
import { clamp } from '../utils/Utilities';
import { SEQUENTIAL_COLOR_PRESETS } from './SequentialColorPresets';

export interface GradeColorBand {
  maxGrade: number;
  color: string;
  label: string;
}

export const GRADE_COLOR_BANDS: GradeColorBand[] = [
  { maxGrade: -25, color: '#08306b', label: '≤-25%' },  // Very dark navy
  { maxGrade: -16, color: '#2171b5', label: '-16%' },   // Medium-dark blue
  { maxGrade: -10, color: '#6baed6', label: '-10%' },   // Medium blue
  { maxGrade: -3,  color: '#c6dbef', label: '-3%' },    // Light blue
  { maxGrade: 3,   color: '#f0f0f0', label: '0%' },     // Neutral gray
  { maxGrade: 10,  color: '#fdae6b', label: '+3%' },    // Light orange
  { maxGrade: 16,  color: '#fd8d3c', label: '+10%' },   // Medium orange
  { maxGrade: 25,  color: '#e6550d', label: '+16%' },   // Strong red-orange
  { maxGrade: Infinity, color: '#a50f15', label: '≥+25%' }  // Dark red
];

export interface ElevationColorStop {
  position: number;  // 0-1 normalized position
  rgb: [number, number, number];
}

export const ELEVATION_COLOR_STOPS: ElevationColorStop[] = [
  { position: 0.0, rgb: [28, 107, 160] },   // Deep water blue
  { position: 0.15, rgb: [58, 149, 200] },  // Shallow water blue
  { position: 0.25, rgb: [34, 139, 34] },   // Lowland green
  { position: 0.4, rgb: [107, 142, 35] },   // Olive green
  { position: 0.55, rgb: [160, 82, 45] },   // Saddle brown
  { position: 0.7, rgb: [139, 69, 19] },    // Dark brown
  { position: 0.85, rgb: [178, 34, 34] },   // Firebrick red
  { position: 1.0, rgb: [139, 0, 0] }       // Dark red (peaks)
];

export function getElevationGradientCSS(): string {
  const colorStrings = ELEVATION_COLOR_STOPS.map(stop => `rgb(${stop.rgb.join(', ')})`);

  return `linear-gradient(to right, ${colorStrings.join(', ')})`;
}

export const HEATMAP_COLOR_PRESETS: Record<string, string[]> = {
  ...SEQUENTIAL_COLOR_PRESETS,
  pastel: ['#9147d4', '#a060dc', '#7e83e3', '#62bde0', '#69d6b0', '#a4de91', '#e5e985', '#ffe080', '#ffc18d', '#f6a0ca', '#ee82bd'],
  'yellow-to-red': ['#FFFFCC', '#FFEDA0', '#FED976', '#FEB24C', '#FD8D3C', '#FC4E2A', '#E31A1C', '#FF0000', '#DD0000', '#AA0000'],
  'blues': ['#F7FBFF', '#DEEBF7', '#C6DBEF', '#9ECAE1', '#6BAED6', '#4292C6', '#2171B5', '#08519C', '#08306B', '#041A3B'],
  'heat': ['#2166ac', '#67a9cf', '#d1e5f0', '#fddbc7', '#ef8a62', '#b2182b'],
  'traffic': ['#00ff00', '#ffff00', '#ff8000', '#ff0000'],
};

export const DEFAULT_HEATMAP_COLOR_SCHEME = 'yellow-to-red';
export const DEFAULT_DENSITY_COLOR_SCHEME = 'plasma';

// Sequential ramp for speed and pace, normalized against the track's own
// range: a walk and a drive each use the full ramp.
export const SPEED_COLOR_STOPS: ElevationColorStop[] = [
  { position: 0, rgb: [69, 117, 180] },    // slow - blue
  { position: 0.25, rgb: [145, 191, 219] },
  { position: 0.5, rgb: [254, 224, 144] },
  { position: 0.75, rgb: [252, 141, 89] },
  { position: 1, rgb: [215, 48, 39] },     // fast - red
];

export class ColorSchemes {
  static getElevationColor(elevation: Meters, minElevation: Meters, maxElevation: Meters): string {
    const range = maxElevation - minElevation;

    if (range === 0) return '#4A90E2';

    const normalized = (elevation - minElevation) / range;

    for (let i = 1; i < ELEVATION_COLOR_STOPS.length; i++) {
      if (normalized <= ELEVATION_COLOR_STOPS[i].position) {
        const start = ELEVATION_COLOR_STOPS[i - 1];
        const end = ELEVATION_COLOR_STOPS[i];

        const factor = (normalized - start.position) / (end.position - start.position);
        const r = Math.round(start.rgb[0] + (end.rgb[0] - start.rgb[0]) * factor);
        const g = Math.round(start.rgb[1] + (end.rgb[1] - start.rgb[1]) * factor);
        const b = Math.round(start.rgb[2] + (end.rgb[2] - start.rgb[2]) * factor);

        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    const lastColor = ELEVATION_COLOR_STOPS[ELEVATION_COLOR_STOPS.length - 1].rgb;

    return `rgb(${lastColor[0]}, ${lastColor[1]}, ${lastColor[2]})`;
  }

  // Color for a value within a track's own min/max range. Pace inverts the
  // ramp, keeping the fast end red in both modes - a low pace number is fast.
  static getSpeedColor(value: number, minValue: number, maxValue: number, invert = false): string {
    const range = maxValue - minValue;

    if (!Number.isFinite(range) || range <= 0) return `rgb(${SPEED_COLOR_STOPS[2].rgb.join(', ')})`;

    const raw = (value - minValue) / range;
    const normalized = Math.min(1, Math.max(0, invert ? 1 - raw : raw));

    for (let i = 1; i < SPEED_COLOR_STOPS.length; i++) {
      if (normalized <= SPEED_COLOR_STOPS[i].position) {
        const start = SPEED_COLOR_STOPS[i - 1];
        const end = SPEED_COLOR_STOPS[i];
        const factor = (normalized - start.position) / (end.position - start.position);
        const channel = (index: number) => Math.round(start.rgb[index] + (end.rgb[index] - start.rgb[index]) * factor);

        return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
      }
    }

    const last = SPEED_COLOR_STOPS[SPEED_COLOR_STOPS.length - 1].rgb;

    return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
  }

  static getGradeColor(grade: number): string {
    for (const band of GRADE_COLOR_BANDS) {
      if (grade <= band.maxGrade) {
        return band.color;
      }
    }

    return GRADE_COLOR_BANDS[GRADE_COLOR_BANDS.length - 1].color;
  }

  static resolveHeatmapColorStops(colorScheme: string | undefined): string[] {
    const key = (colorScheme ?? '').trim().toLowerCase();

    if (key === 'soft') return HEATMAP_COLOR_PRESETS.pastel;
    if (HEATMAP_COLOR_PRESETS[key]) return HEATMAP_COLOR_PRESETS[key];

    const custom = this.parseHeatmapColorStops(colorScheme ?? '');

    if (custom.length >= 2) return custom;
    if (custom.length === 1) return [custom[0], custom[0]];

    return HEATMAP_COLOR_PRESETS[DEFAULT_HEATMAP_COLOR_SCHEME];
  }

  static parseHeatmapColorStops(value: string): string[] {
    return value
      .split(/[,\n]/)
      .map((part) => this.normalizeHexColor(part))
      .filter((part): part is string => part !== null);
  }

  private static normalizeHexColor(value: string): string | null {
    const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());

    if (!match) return null;
    const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];

    return `#${hex.toLowerCase()}`;
  }

  private static hexToRgb(hex: string): [number, number, number] {
    const value = parseInt(hex.replace('#', ''), 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  private static rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((c) => clamp(c, 0, 255).toString(16).padStart(2, '0')).join('')}`;
  }

  // Interpolate a normalized 0-1 position across an ordered list of hex stops.
  static interpolateHeatmapStops(normalized: number, stops: string[]): string {
    const clamped = clamp(normalized, 0, 1);

    if (stops.length === 1) return stops[0];

    const numSegments = stops.length - 1;
    const segmentIndex = Math.min(Math.floor(clamped * numSegments), numSegments - 1);
    const ratio = clamped * numSegments - segmentIndex;

    const start = this.hexToRgb(stops[segmentIndex]);
    const end = this.hexToRgb(stops[segmentIndex + 1]);

    return this.rgbToHex(
      Math.round(start[0] + (end[0] - start[0]) * ratio),
      Math.round(start[1] + (end[1] - start[1]) * ratio),
      Math.round(start[2] + (end[2] - start[2]) * ratio),
    );
  }

  static getHeatmapColor(normalizedWeight: number, colorScheme: string): string {
    return this.interpolateHeatmapStops(normalizedWeight, this.resolveHeatmapColorStops(colorScheme));
  }

  static getHeatmapColorRgb(normalizedWeight: number, colorScheme: string): [number, number, number] {
    return this.hexToRgb(this.getHeatmapColor(normalizedWeight, colorScheme));
  }

  // CSS gradient for legends, evenly spaced across the resolved stops.
  static getHeatmapGradientCSS(colorScheme: string): string {
    return `linear-gradient(to right, ${this.resolveHeatmapColorStops(colorScheme).join(', ')})`;
  }

  // CSS gradient for opacity-stacking legends: one peak color, increasing opacity.
  static getHeatmapOpacityGradientCSS(colorScheme: string): string {
    const [r, g, b] = this.hexToRgb(this.getHeatmapCircleColor(colorScheme));

    return `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0.08), rgba(${r}, ${g}, ${b}, 1))`;
  }

  // Single representative (peak) color - used for opacity-stacking and circle fills.
  static getHeatmapCircleColor(colorScheme: string): string {
    const stops = this.resolveHeatmapColorStops(colorScheme);

    return stops[stops.length - 1];
  }
}
