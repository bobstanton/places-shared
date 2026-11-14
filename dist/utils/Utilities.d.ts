import { Coordinate } from '../geo/DistanceCalculator';
export declare function getErrorMessage(error: unknown): string;
export declare function fnvHash(text: string): string;
export declare function fnvHash64(text: string): string;
export declare function hashString36(text: string): string;
export declare function roundTo(value: number, decimals: number): number;
export declare function getError(error: unknown): Error;
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T>;
export declare function sleep(ms: number): Promise<void>;
export declare function clamp(value: number, min: number, max: number): number;
export declare function coerceScalarString(value: unknown): string;
export declare function numericRange(values: Iterable<number>): {
    min: number;
    max: number;
} | null;
export declare function preventWheelPropagation(element: HTMLElement): void;
export declare function normalizePath(path: string): string;
export declare function formatDisplayCoordinate(coordinate: Coordinate, precision?: number): string;
export declare function getFileNameWithoutExtension(path: string | null | undefined, fallback?: string, extensionPattern?: RegExp): string;
export interface ErrorOptions {
    icon?: string;
    title: string;
    message?: string;
    className?: string;
}
export interface ErrorHelpSection {
    type: string;
    title: string;
    items?: string[];
    code?: string;
}
export interface ErrorWithHelpOptions extends ErrorOptions {
    help?: string;
    helpSections?: ErrorHelpSection[];
}
export declare function renderError(container: HTMLElement, options: ErrorOptions): HTMLElement;
export declare function renderErrorWithHelp(container: HTMLElement, options: ErrorWithHelpOptions): HTMLElement;
export declare function renderMapSurfaceError(container: HTMLElement, options: ErrorWithHelpOptions): HTMLElement;
export declare function renderMapSupplementalError(container: HTMLElement, options: ErrorWithHelpOptions): HTMLElement;
export declare class Utilities {
    static applyDefaults(extensionSettings: Record<string, string>, defaults: Record<string, string>): void;
    static parseLocationString(location: string): Coordinate | null;
    static sanitizeFilename(filename: string): string;
    static formatDuration(durationSeconds: number, includeSeconds?: boolean, padHours?: boolean): string;
    static formatDateAsYYYYMMDD(date: Date): string;
    static isDataviewUnavailableError(error: unknown): boolean;
    static isVaultQueryUnavailableError(error: unknown): boolean;
}
export declare const PLUGIN_ERRORS: {
    readonly DATAVIEW: "Dataview plugin is not available";
    readonly VAULTQUERY: "VaultQuery plugin is not available";
};
export declare function parseContributingFiles(value: unknown): string[];
export declare function removeRedundantPlaceAddressParts(place: {
    name: string;
    address: string;
    country: string;
}): void;
export declare const MapConstants: {
    readonly CLUSTER_MAX_ZOOM: 17;
    readonly CLICK_PROXIMITY_THRESHOLD_PX: 50;
    readonly CLUSTER_SIZES: {
        readonly SMALL: {
            readonly threshold: 0;
            readonly radius: 20;
        };
        readonly MEDIUM: {
            readonly threshold: 100;
            readonly radius: 30;
        };
        readonly LARGE: {
            readonly threshold: 750;
            readonly radius: 40;
        };
    };
    readonly CLUSTER_COLORS: {
        readonly SMALL: "#51bbd6";
        readonly MEDIUM: "#f1f075";
        readonly LARGE: "#f28cb1";
    };
};
export declare function scalarToString(value: unknown, fallback?: string): string;
export declare function serializeUnknown(value: unknown, fallback?: string): string;
export declare function normalizePropertyName(key: string): string;
export declare function readNormalizedProperty(source: Record<string, unknown> | undefined, key: string): unknown;
