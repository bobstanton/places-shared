export interface SettingsTraceLayer {
    name: string;
    values: Record<string, unknown>;
}
export interface SettingsTraceRow {
    key: string;
    layerValues: string[];
    resolved: string;
    winnerLayerIndex: number;
    source: string;
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
export declare function formatTraceValue(value: unknown): string;
export declare function buildSettingsTrace(layers: SettingsTraceLayer[], resolved: Record<string, unknown>, options?: BuildSettingsTraceOptions): SettingsTrace;
export declare function settingsTraceToMarkdown(trace: SettingsTrace): string;
