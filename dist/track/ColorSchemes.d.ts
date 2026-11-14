import type { Meters } from '../Units';
export interface GradeColorBand {
    maxGrade: number;
    color: string;
    label: string;
}
export declare const GRADE_COLOR_BANDS: GradeColorBand[];
export interface ElevationColorStop {
    position: number;
    rgb: [number, number, number];
}
export declare const ELEVATION_COLOR_STOPS: ElevationColorStop[];
export declare function getElevationGradientCSS(): string;
export declare const HEATMAP_COLOR_PRESETS: Record<string, string[]>;
export declare const DEFAULT_HEATMAP_COLOR_SCHEME = "yellow-to-red";
export declare const DEFAULT_DENSITY_COLOR_SCHEME = "plasma";
export declare const SPEED_COLOR_STOPS: ElevationColorStop[];
export declare class ColorSchemes {
    static getElevationColor(elevation: Meters, minElevation: Meters, maxElevation: Meters): string;
    static getSpeedColor(value: number, minValue: number, maxValue: number, invert?: boolean): string;
    static getGradeColor(grade: number): string;
    static resolveHeatmapColorStops(colorScheme: string | undefined): string[];
    static parseHeatmapColorStops(value: string): string[];
    private static normalizeHexColor;
    private static hexToRgb;
    private static rgbToHex;
    static interpolateHeatmapStops(normalized: number, stops: string[]): string;
    static getHeatmapColor(normalizedWeight: number, colorScheme: string): string;
    static getHeatmapColorRgb(normalizedWeight: number, colorScheme: string): [number, number, number];
    static getHeatmapGradientCSS(colorScheme: string): string;
    static getHeatmapOpacityGradientCSS(colorScheme: string): string;
    static getHeatmapCircleColor(colorScheme: string): string;
}
