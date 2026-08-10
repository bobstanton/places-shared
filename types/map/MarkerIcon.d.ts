export declare const DEFAULT_MARKER_ICON = "\uD83D\uDCCD";
export declare function addTagMetadata(metadata: Record<string, unknown>, tags: unknown): void;
export declare function configureMarkerIconRules(lines: string[] | undefined): void;
export declare function defaultMarkerIconRules(): string[];
export declare function resolveMarkerIcon(explicitIcon: unknown): string;
export declare function resolveDefaultMarkerIcon(tags: unknown, name?: unknown): string;
export declare function matchMarkerIconRule(tags: unknown, name?: unknown): string | undefined;
