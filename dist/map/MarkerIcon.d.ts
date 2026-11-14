export declare const DEFAULT_MARKER_ICON = "\uD83D\uDCCD";
export declare function addTagMetadata(metadata: Record<string, unknown>, tags: unknown): void;
export declare const CURRENT_MARKER_ICON_RULES_REVISION = 1;
export declare function configureMarkerIconRules(lines: string[] | undefined): void;
export declare function defaultMarkerIconRules(): string[];
export declare function upgradeMarkerIconRules(lines: string[] | undefined, revision: unknown): string[];
export declare function resolveMarkerIcon(explicitIcon: unknown): string;
export declare function resolveDefaultMarkerIcon(tags: unknown, name?: unknown, path?: unknown): string;
export declare function matchMarkerIconRule(tags: unknown, name?: unknown, path?: unknown): string | undefined;
