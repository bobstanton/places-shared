import type { ResolvedMapConfig } from "../settings/index";
export type MarkerRendererKind = 'native' | 'html';
export declare function markerRendererKind(settings: ResolvedMapConfig): MarkerRendererKind;
export declare function usesNativeMarkerRenderer(settings: ResolvedMapConfig): boolean;
