import { parseBoolean, parseNumber, parseEnumWithDefault } from './ParseHelpers';
import { codeBlockText } from './CodeBlockYaml';
import { DEFAULT_GRADE_DISTANCE_FEET } from './MapDefaults';
import { DEFAULT_GRADE_WINDOW, DEFAULT_SPEED_WINDOW, parseMetricWindow, type MetricWindow } from './MetricWindow';

export { DEFAULT_GRADE_DISTANCE_FEET, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from './MapDefaults';


export const DEFAULT_ROUTE_LABEL_TEMPLATE = '{this.distance_text} · {this.duration_text}';

// Resolved against the track note's frontmatter.
export const DEFAULT_PATH_START_LABEL_TEMPLATE = '';
export const DEFAULT_PATH_MIDPOINT_LABEL_TEMPLATE = "{(["
  + "this.Distance ? h.round(this.Distance) : '', "
  + "this['Elevation Gain'] ? h.round(this['Elevation Gain']) : ''"
  + "].filter(Boolean).join(' · '))}";
export const DEFAULT_PATH_END_LABEL_TEMPLATE = '';

// Coded defaults for waypoint labels, shared by directions route endpoints and GPX `<wpt>` markers.
// Directions endpoints carry a positional role (start / stop N / end), and their default prefixes the
// name with `{this.role_label}`. GPX `<wpt>` are role-less and default to the bare name. Both are
// driven by the same `waypointLabelTemplate` key (block > global > coded); an explicitly empty value hides.
export const DEFAULT_WAYPOINT_LABEL_TEMPLATE = '{this.role_label}: {this.name}';
export const DEFAULT_GPX_WAYPOINT_LABEL_TEMPLATE = '{this.name}';

// Resolve a label template through the override cascade: note frontmatter > code block > global > coded.
// A value present at the note or block level wins even when empty (empty = hide the label). An empty
// global setting means "no override", and the coded default applies.
export function resolveCascadedLabelTemplate(
  noteValue: string | undefined,
  blockValue: string | undefined,
  globalDefault: string,
  codedDefault: string,
): string {
  if (noteValue !== undefined) return noteValue;
  if (blockValue !== undefined) return blockValue;
  return globalDefault.trim() !== '' ? globalDefault : codedDefault;
}

export interface BaseBlockSettings {
  height: string;
  width: string;
}


export interface NormalizedChartBlockSettings {
  height: string;
  width: string;

  title: string;
  chartType: string;
  colorBy: string;

  showGrid: boolean;
  showPoints: boolean;
  smoothing: boolean;
  fillArea: boolean;

  axisColor: string;
  elevationColor: string;
  speedColor: string;
  paceColor: string;
  gradeColor: string;

  fontSize: number;
  gradeWindow: MetricWindow;
  speedWindow: MetricWindow;

  stats: string;

  legend: 'hidden' | 'top' | 'bottom';

  track1?: string;
  track2?: string;
  // Coordinate to highlight on a single-track chart.
  position?: string;
  // Typed selection channel shared with maps and other charts.
  selectionChannel?: string;
}

export const DEFAULT_NORMALIZED_CHART_SETTINGS: NormalizedChartBlockSettings = {
  height: '30vh',
  width: '100%',
  title: 'Elevation Profile',
  chartType: 'elevation',
  colorBy: 'none',
  showGrid: true,
  showPoints: false,
  smoothing: true,
  fillArea: true,
  axisColor: '#666',
  elevationColor: '#2196F3',
  speedColor: '#ff7f00',
  paceColor: '#dc3545',
  gradeColor: '#ff7f00',
  fontSize: 12,
  gradeWindow: DEFAULT_GRADE_WINDOW,
  speedWindow: DEFAULT_SPEED_WINDOW,
  stats: '',
  legend: 'hidden'
};

export function normalizeChartBlockSettings(raw: Record<string, unknown>): NormalizedChartBlockSettings {
  const d = DEFAULT_NORMALIZED_CHART_SETTINGS;
  const text = (key: string): string | undefined => codeBlockText(raw, key);

  return {
    height: text('height') || d.height,
    width: text('width') || d.width,
    title: text('title') || d.title,
    chartType: text('chartType') || d.chartType,
    colorBy: text('colorBy') || d.colorBy,
    showGrid: parseBoolean(raw.showGrid, d.showGrid),
    showPoints: parseBoolean(raw.showPoints, d.showPoints),
    smoothing: parseBoolean(raw.smoothing, d.smoothing),
    fillArea: parseBoolean(raw.fillArea, d.fillArea),
    axisColor: text('axisColor') || d.axisColor,
    elevationColor: text('elevationColor') || d.elevationColor,
    speedColor: text('speedColor') || d.speedColor,
    paceColor: text('paceColor') || d.paceColor,
    gradeColor: text('gradeColor') || d.gradeColor,
    fontSize: parseNumber(raw.fontSize, d.fontSize),
    // `gradeDistance:` is the older spelling, an unlabelled feet number.
    gradeWindow: raw.gradeWindow !== undefined || raw.gradeDistance === undefined
      ? parseMetricWindow(raw.gradeWindow, d.gradeWindow)
      : { kind: 'distance', km: parseNumber(raw.gradeDistance, DEFAULT_GRADE_DISTANCE_FEET) * 0.0003048 },
    speedWindow: parseMetricWindow(raw.speedWindow, d.speedWindow),
    stats: text('stats') || d.stats,
    legend: parseEnumWithDefault(raw.legend, ['hidden', 'top', 'bottom'] as const, d.legend),
    track1: text('track1'),
    track2: text('track2'),
    position: text('position'),
    selectionChannel: codeBlockMapping(raw.selection)?.channel
  };
}

function codeBlockMapping(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, string>;
}
