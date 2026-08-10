import type { VectorTileSourceDefinition } from './OverlaySystem';

// One entry of a TileJSON `vector_layers` array: the tileset's own description
// of a source layer. Optional even for vector tilesets. Does not report
// geometry type; that comes only from the features.
export interface TileJsonVectorLayer {
  id: string;
  // Property name to its declared type ("String", "Number", "Boolean").
  fields: Record<string, string>;
  description?: string;
  minzoom?: number;
  maxzoom?: number;
}

// The fields of a TileJSON document that Places maps onto a GL vector source.
export interface ResolvedTileJson {
  tiles: string[];
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  attribution?: string;
  // Present only when the document declares vector_layers.
  vectorLayers?: TileJsonVectorLayer[];
}

// Resolve a tile URL template against the TileJSON's own URL (templates may be
// relative). URL resolution percent-encodes the `{z}`/`{x}`/`{y}` placeholders;
// they are restored for template substitution to match.
export function resolveTileUrlTemplate(template: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(template)) return template;
  try {
    return new URL(template, baseUrl).href.replace(/%7B/gi, '{').replace(/%7D/gi, '}');
  } catch {
    return template;
  }
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

// Read `vector_layers`, skipping entries without a usable id rather than failing the whole document.
function parseVectorLayers(value: unknown): TileJsonVectorLayer[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const layers: TileJsonVectorLayer[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) continue;

    const fields: Record<string, string> = {};
    if (record.fields && typeof record.fields === 'object' && !Array.isArray(record.fields)) {
      for (const [name, type] of Object.entries(record.fields as Record<string, unknown>)) {
        fields[name] = typeof type === 'string' ? type : String(type);
      }
    }

    layers.push({
      id,
      fields,
      ...(typeof record.description === 'string' && record.description.trim() ? { description: record.description.trim() } : {}),
      ...(readFiniteNumber(record.minzoom) !== undefined ? { minzoom: readFiniteNumber(record.minzoom) } : {}),
      ...(readFiniteNumber(record.maxzoom) !== undefined ? { maxzoom: readFiniteNumber(record.maxzoom) } : {}),
    });
  }

  return layers.length > 0 ? layers : undefined;
}

// Throws when the document has no usable tiles array.
export function parseTileJson(document: Record<string, unknown>, baseUrl: string): ResolvedTileJson {
  const rawTiles = document.tiles;
  if (!Array.isArray(rawTiles) || rawTiles.length === 0 || rawTiles.some(tile => typeof tile !== 'string')) {
    throw new Error('TileJSON must include a non-empty tiles array');
  }

  const vectorLayers = parseVectorLayers(document.vector_layers);
  const minzoom = readFiniteNumber(document.minzoom);
  const maxzoom = readFiniteNumber(document.maxzoom);
  const bounds = Array.isArray(document.bounds) && document.bounds.length === 4
    ? document.bounds.map(value => Number(value)) as [number, number, number, number]
    : undefined;

  return {
    tiles: rawTiles.map(tile => resolveTileUrlTemplate(tile as string, baseUrl)),
    ...(minzoom !== undefined ? { minzoom } : {}),
    ...(maxzoom !== undefined ? { maxzoom } : {}),
    ...(bounds?.every(Number.isFinite) ? { bounds } : {}),
    ...(typeof document.attribution === 'string' ? { attribution: document.attribution } : {}),
    ...(vectorLayers ? { vectorLayers } : {}),
  };
}

// Session-scoped TileJSON loader: one fetch per URL, shared by every entry and
// re-render in the session. A failed load is dropped from the memo: a later
// render retries instead of caching the error.
export function createTileJsonResolver(fetchTileJsonText: (url: string) => Promise<string>): (url: string) => Promise<ResolvedTileJson> {
  const cache = new Map<string, Promise<ResolvedTileJson>>();
  return url => {
    const cached = cache.get(url);
    if (cached) return cached;
    const load = fetchTileJsonText(url).then(text => parseTileJson(JSON.parse(text) as Record<string, unknown>, url));
    cache.set(url, load);
    load.catch(() => {
      if (cache.get(url) === load) cache.delete(url);
    });
    return load;
  };
}

// Build the GL vector source spec for a vector tile overlay. A map zoomed past
// the tileset's maxzoom overzooms the deepest tiles instead of requesting
// missing ones. Entry-level bounds/attribution override TileJSON values. Entry
// visibility zoom (overlay.zoom) is a layer setting and never reaches the
// source: a source-level clamp would forbid tile fetches for every entry
// sharing the source.
export function createVectorTileSourceSpec(overlay: VectorTileSourceDefinition, tileJson: ResolvedTileJson | undefined, transformTileUrl: (url: string) => string = url => url): Record<string, unknown> {
  const tiles = tileJson?.tiles ?? overlay.tiles;
  const bounds = overlay.bounds ?? tileJson?.bounds;
  const attribution = overlay.attribution ?? tileJson?.attribution;
  return {
    type: 'vector',
    ...(tiles ? { tiles: tiles.map(transformTileUrl) } : {}),
    ...(tileJson?.minzoom !== undefined ? { minzoom: tileJson.minzoom } : {}),
    ...(tileJson?.maxzoom !== undefined ? { maxzoom: tileJson.maxzoom } : {}),
    ...(bounds ? { bounds } : {}),
    ...(attribution ? { attribution } : {}),
  };
}
