import type { Map as GlMap } from 'maplibre-gl';
import { TileCache } from "../map/index";

type TileId = { x: number; y: number; z: number };
interface TileEvent {
  sourceId?: string;
  dataType?: string;
  error?: { name?: string; url?: string; status?: number; message?: string };
  tile?: { tileID?: { canonical?: TileId }; state?: string };
}
interface Failure { source: string; tile?: TileId; url?: string; retryable: boolean }
const tileKey = (source: string, tile?: TileId) => `${source}:${tile ? `${tile.z}/${tile.x}/${tile.y}` : '*'}`;

export function attachMapTileRecovery(map: GlMap): () => void {
  const win = map.getContainer().ownerDocument.defaultView!;
  const failures = new Map<string, Failure>();
  let timer: number | undefined;
  let delay = 5000;
  let disposed = false;

  const supported = (id?: string): id is string => {
    if (!id) return false;
    const type = map.getSource(id)?.type;

    return type === 'vector' || type === 'raster' || type === 'raster-dem';
  };
  const resetRetryWhenRecovered = () => {
    if (!failures.size) {
      if (timer !== undefined) win.clearTimeout(timer);
      timer = undefined; delay = 5000;
    }
  };
  const schedule = (wait = delay) => {
    if (disposed || timer !== undefined || ![...failures.values()].some(f => f.retryable)) return;
    timer = win.setTimeout(() => { timer = undefined; retryTiles(); }, wait);
  };
  const retryTiles = () => {
    if (disposed) return;
    if (timer !== undefined) win.clearTimeout(timer);
    timer = undefined;

    if (win.navigator.onLine === false) { schedule();

 return; }

    const sources = new Map<string, TileId[] | undefined>();

    for (const [key, failure] of failures) {
      if (!supported(failure.source)) { failures.delete(key); continue; }
      if (!failure.retryable) continue;
      if (!sources.has(failure.source)) sources.set(failure.source, []);
      const tiles = sources.get(failure.source);

      if (!failure.tile) sources.set(failure.source, undefined);
      else tiles?.push(failure.tile);
    }

    for (const [sourceId, tiles] of sources) {
      const source = map.getSource(sourceId) as { setTiles?(tiles: string[]): void; setUrl?(url: string): void };
      const spec = map.getStyle()?.sources[sourceId];

      if (!tiles && spec && 'url' in spec && spec.url && source.setUrl) source.setUrl(spec.url);
      else if (typeof map.refreshTiles === 'function') map.refreshTiles(sourceId, tiles);
      else if (spec && 'tiles' in spec && spec.tiles && source.setTiles) source.setTiles(spec.tiles);
      else if (spec && 'url' in spec && spec.url && source.setUrl) source.setUrl(spec.url);
    }

    delay = Math.min(30_000, delay * 2);
    resetRetryWhenRecovered(); schedule();
  };
  const onError = (event: TileEvent) => {
    if (!supported(event.sourceId) || event.error?.name === 'AbortError') return;
    const tile = event.tile?.tileID?.canonical;
    const code = event.error?.status ?? Number(/\bstatus[:\s]+(\d{3})\b/i.exec(event.error?.message ?? '')?.[1]);

    failures.set(tileKey(event.sourceId, tile), { source: event.sourceId, tile, url: event.error?.url,
      retryable: !code || code === 429 || code >= 500 });
    resetRetryWhenRecovered(); schedule();
  };
  const onData = (event: TileEvent) => {
    if (event.dataType !== 'source' || !supported(event.sourceId) || !event.tile || event.tile.state === 'errored') return;
    const key = tileKey(event.sourceId, event.tile.tileID?.canonical);
    const failure = failures.get(key);

    if (!failure?.url || !TileCache.isNetworkDegraded(failure.url)) failures.delete(key);
    failures.delete(tileKey(event.sourceId));
    resetRetryWhenRecovered();
  };
  const onOnline = () => {
    for (const failure of failures.values()) if (failure.url) TileCache.retryNetwork(failure.url);
    if (timer !== undefined) win.clearTimeout(timer);
    timer = undefined; schedule(250);
  };
  const onMoveEnd = () => {
    const bounds = map.getBounds();

    if (!bounds) return;
    const center = (bounds.getWest() + bounds.getEast()) / 2;

    for (const [key, failure] of failures) {
      if (!failure.tile) continue;
      const { x, y, z } = failure.tile;
      const size = 2 ** z;
      const west = x / size * 360 - 180;
      const east = (x + 1) / size * 360 - 180;
      const shift = 360 * Math.round((center - (west + east) / 2) / 360);
      const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) * 180 / Math.PI;
      const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / size))) * 180 / Math.PI;

      if (east + shift < bounds.getWest() || west + shift > bounds.getEast()
        || north < bounds.getSouth() || south > bounds.getNorth()) failures.delete(key);
    }

    resetRetryWhenRecovered();
  };
  const unsubscribe = TileCache.onNetworkRecovery(host => {
    if ([...failures.values()].some(f => f.url && new URL(f.url).host === host)) onOnline();
  });

  map.on('error', onError);
  map.on('data', onData);
  map.on('moveend', onMoveEnd);
  win.addEventListener('online', onOnline);

  const dispose = () => {
    disposed = true;
    if (timer !== undefined) win.clearTimeout(timer);
    win.removeEventListener('online', onOnline);
    map.off('error', onError); map.off('data', onData); map.off('moveend', onMoveEnd);
    unsubscribe(); failures.clear();
  };

  void map.once('remove', dispose);

  return dispose;
}
