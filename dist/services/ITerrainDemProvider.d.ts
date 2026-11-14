import type { TerrainDemSpec } from "../map/TerrainDem";
export interface ITerrainDemProvider {
    getDemSource(): TerrainDemSpec | null;
}
