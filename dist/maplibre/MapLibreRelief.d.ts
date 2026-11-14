import type * as maplibregl from 'maplibre-gl';
import { type HillshadeOptions, type TerrainDemSpec, type ColorReliefStop } from "../map/index";
export type { HillshadeOptions };
export declare function applyHillshade(map: maplibregl.Map, dem: TerrainDemSpec, options: HillshadeOptions): void;
export declare function applyColorRelief(map: maplibregl.Map, dem: TerrainDemSpec, opacity: number, stops?: readonly ColorReliefStop[]): void;
