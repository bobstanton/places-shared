import type { MapSourceContext } from "../settings/MapConfiguration";
import { sharedRegistryMap } from "../utils/CrossBundleRegistry";

export interface MapState {
  zoom: number;
  center: { lat: number; lng: number };
}

const MAP_STATES_KEY = Symbol.for("places.map.viewport-states");

function getViewportStates(): Map<string, MapState> {
  return sharedRegistryMap<string, MapState>(MAP_STATES_KEY);
}

export class MapStateManager {
  static getStateKey(source: MapSourceContext): string | null {
    const sourcePath = source.path;
    const lineStart = source.lineStart;
    if (!sourcePath || lineStart === undefined) return null;
    return `${sourcePath}:${lineStart}`;
  }

  static getSavedState(source: MapSourceContext): MapState | null {
    const key = this.getStateKey(source);
    if (!key) return null;
    return getViewportStates().get(key) || null;
  }

  static saveState(stateKey: string | null, state: MapState): void {
    if (!stateKey) return;
    getViewportStates().set(stateKey, state);
  }

  static clearState(stateKey: string): void {
    getViewportStates().delete(stateKey);
  }

  static clearAllStates(): void {
    getViewportStates().clear();
  }
}
