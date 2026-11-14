import type * as GeoJSON from 'geojson';
import type { App } from 'obsidian';
import { type GeoJSONOverlay, type Overlay } from '../../overlay/index';
import type { MapRenderRequest, PopupContentConfig } from '../../settings/index';
export declare function resolveOverlayPointSource(properties: Record<string, unknown>, overlays: readonly Overlay[], fallbackSourcePath?: string): {
    sourcePath?: string;
    overlay?: GeoJSONOverlay;
};
export interface OverlayPointPopupOptions {
    app: App;
    feature: GeoJSON.Feature;
    sourcePath?: string;
    popupConfig?: PopupContentConfig;
    markdownSourcePath?: string;
    popupRenderers?: MapRenderRequest['runtime']['popupRenderers'];
    onRendered?: () => void;
}
export declare function buildOverlayPointPopup(options: OverlayPointPopupOptions): HTMLElement;
