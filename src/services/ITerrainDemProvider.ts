import type { TerrainDemSpec } from "../map/TerrainDem";

// A provider's raster-DEM elevation source for 3D terrain, selected with
// `terrainProvider: <provider name>`. The provider interpolates its own API key
// into the returned tile URLs; the main plugin collects these by provider name,
// and the map base never needs another provider's credentials. Returns `null`
// when no key is configured.
export interface ITerrainDemProvider {
  getDemSource(): TerrainDemSpec | null;
}
