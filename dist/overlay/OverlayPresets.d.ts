import type { OverlayRenderStyle, VectorTileFilter, VectorTileLayerType, VectorTileOverlay } from './OverlaySystem';
import type { ZoomRange } from '../ZoomVisibility';
import type { PopupContentConfig } from '../settings/PopupConfiguration';
export interface VectorTileOverlayPresetLayer {
    readonly sourceLayer: string;
    readonly layerType: VectorTileLayerType;
    readonly zoom?: ZoomRange;
    readonly filter?: VectorTileFilter;
    readonly style?: OverlayRenderStyle;
    readonly hoverStyle?: OverlayRenderStyle;
    readonly popup?: PopupContentConfig;
    readonly hitLabel?: string;
}
export interface VectorTileOverlayPreset {
    readonly id: string;
    readonly description: string;
    readonly provider: string;
    readonly attribution: string;
    readonly tileZoom?: ZoomRange;
    readonly layers: readonly VectorTileOverlayPresetLayer[];
    tiles(): readonly string[];
}
export interface VectorTileOverlayPresetOverrides {
    readonly source: string;
    readonly sourceLayers?: readonly string[];
    readonly zoom?: ZoomRange;
    readonly filter?: VectorTileFilter;
    readonly style?: OverlayRenderStyle;
    readonly hoverStyle?: OverlayRenderStyle;
    readonly popup?: PopupContentConfig;
}
export declare function expandVectorTileOverlayPreset(preset: VectorTileOverlayPreset, overrides: VectorTileOverlayPresetOverrides): VectorTileOverlay[];
