import type { MapConfigPatch } from './MapConfiguration';
export declare const PLACE_SETTINGS_KEYS: readonly ["labelTemplate", "iconRotation", "iconImage", "iconStyles", "iconImageStyles", "labelStyles", "popup", "markerMinZoom", "markerMaxZoom", "labelMinZoom", "labelMaxZoom", "trackMinZoom", "trackMaxZoom", "overlayMinZoom", "overlayMaxZoom", "track"];
export declare const PLACE_SETTINGS_PATHS: readonly string[];
export interface PlaceSettingsLayer {
    source: 'query' | 'note';
    values: MapConfigPatch;
}
export declare function parsePlaceSettings(row: Readonly<Record<string, unknown>> | undefined, source: 'note' | 'query'): MapConfigPatch;
export declare function mergePlaceSettings(layers: readonly Pick<PlaceSettingsLayer, 'values'>[]): MapConfigPatch;
