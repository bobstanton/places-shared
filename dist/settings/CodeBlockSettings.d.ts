import { type MetricWindow } from './MetricWindow';
export { DEFAULT_GRADE_DISTANCE_FEET, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH } from './MapDefaults';
export declare const DEFAULT_ROUTE_LABEL_TEMPLATE = "{this.distance_text} \u00B7 {this.duration_text}";
export declare const DEFAULT_PATH_START_LABEL_TEMPLATE = "";
export declare const DEFAULT_PATH_MIDPOINT_LABEL_TEMPLATE: string;
export declare const DEFAULT_PATH_END_LABEL_TEMPLATE = "";
export declare const DEFAULT_WAYPOINT_LABEL_TEMPLATE = "{this.role_label}: {this.name}";
export declare const DEFAULT_GPX_WAYPOINT_LABEL_TEMPLATE = "{this.name}";
export declare function resolveCascadedLabelTemplate(noteValue: string | undefined, blockValue: string | undefined, globalDefault: string, codedDefault: string): string;
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
    position?: string;
    selectionChannel?: string;
}
export declare const DEFAULT_NORMALIZED_CHART_SETTINGS: NormalizedChartBlockSettings;
export declare function normalizeChartBlockSettings(raw: Record<string, unknown>, windows?: Pick<NormalizedChartBlockSettings, 'gradeWindow' | 'speedWindow'>): NormalizedChartBlockSettings;
