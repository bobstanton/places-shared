import type { MapSourceContext } from "../settings/MapConfiguration";
export interface MapState {
    zoom: number;
    center: {
        lat: number;
        lng: number;
    };
}
export declare class MapStateManager {
    static getStateKey(source: MapSourceContext): string | null;
    static getSavedState(source: MapSourceContext): MapState | null;
    static saveState(stateKey: string | null, state: MapState): void;
    static clearState(stateKey: string): void;
    static clearAllStates(): void;
}
