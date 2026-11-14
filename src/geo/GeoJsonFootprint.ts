import type * as GeoJSON from 'geojson';

export interface GeoJsonFootprint {
  features: number;
  vertices: number;
  estimatedBytes: number;
}

export function geoJsonFootprint(value: GeoJSON.GeoJSON): GeoJsonFootprint {
  const result = { features: 0, vertices: 0, estimatedBytes: 0 };
  const coordinates = (values: unknown[]): void => {
    result.estimatedBytes += 32 + values.length * 8;

    if (typeof values[0] === 'number') { result.vertices++;

 return; }

    for (const child of values) if (Array.isArray(child)) coordinates(child);
  };
  const properties = (input: unknown): number => {
    if (typeof input === 'string') return 16 + input.length * 2;
    if (!input || typeof input !== 'object') return 8;
    if (Array.isArray(input)) return 32 + input.reduce<number>((size, item) => size + properties(item), 0);
    let size = 64;

    for (const [key, item] of Object.entries(input)) size += 16 + key.length * 2 + properties(item);

    return size;
  };
  const walk = (node: GeoJSON.GeoJSON): void => {
    result.estimatedBytes += 64;

    if (node.type === 'FeatureCollection') {
      result.estimatedBytes += 32 + node.features.length * 8;
      for (const feature of node.features) walk(feature);
    } else if (node.type === 'Feature') {
      result.features++;
      result.estimatedBytes += properties(node.properties) + properties(node.id);
      if (node.geometry) walk(node.geometry);
    } else if (node.type === 'GeometryCollection') {
      for (const geometry of node.geometries) walk(geometry);
    } else coordinates(node.coordinates);
  };

  walk(value);

  return result;
}
