import { normalizePath, Platform, type App } from "obsidian";
import type * as maplibregl from "maplibre-gl";
import { PMTiles, Protocol, TileType, type RangeResponse, type Source } from "pmtiles";
import { logger } from "../../utils/index";
import { PMTILES_PROTOCOL, pmtilesArchiveKey, pmtilesVaultPath } from "../../overlay/index";

export type ProtocolRegistrar = (customProtocol: string, loadFn: maplibregl.AddProtocolAction) => void;

declare const require: (id: string) => unknown;

interface NodeFileHandle {
  read(buffer: Uint8Array, offset: number, length: number, position: number): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
}

interface NodeFsPromises {
  open(path: string, flags: string): Promise<NodeFileHandle>;
}

// Obsidian's vault resource scheme ignores Range and returns the whole
// PMTiles archive for every tile request.
export class VaultArchiveSource implements Source {
  private whole?: Promise<ArrayBuffer>;

  constructor(private readonly app: App, private readonly url: string, private readonly vaultPath: string) {}

  getKey(): string {
    return pmtilesArchiveKey(this.url);
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    signal?.throwIfAborted();

    const ranged = await this.readRange(offset, length);

    if (ranged) return { data: ranged };

    const whole = await (this.whole ??= this.app.vault.adapter.readBinary(normalizePath(this.vaultPath)));

    return { data: whole.slice(offset, offset + length) };
  }

  private async readRange(offset: number, length: number): Promise<ArrayBuffer | undefined> {
    if (!Platform.isDesktop) return undefined;
    const adapter = this.app.vault.adapter as { getFullPath?: (path: string) => string };

    if (typeof adapter.getFullPath !== 'function') return undefined;
    const fsPromises = require("fs/promises") as NodeFsPromises;
    const handle = await fsPromises.open(adapter.getFullPath(normalizePath(this.vaultPath)), "r");

    try {
      const buffer = new Uint8Array(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);

      return buffer.buffer.slice(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
}

const protocolState: { protocol?: Protocol } = {};

export function installPmtilesProtocol(register: ProtocolRegistrar): void {
  if (protocolState.protocol) return;
  const created = new Protocol({ metadata: false });

  protocolState.protocol = created;
  register(PMTILES_PROTOCOL, created.tile);
}

const TILE_TYPE_NAMES: Record<number, string> = { 2: 'A PNG', 3: 'A JPEG', 4: 'A WebP', 5: 'An AVIF' };

export async function assertVectorPmtilesArchive(url: string): Promise<void> {
  const archive = protocolState.protocol?.get(pmtilesArchiveKey(url));

  if (!archive) return;
  const { tileType } = await archive.getHeader();

  if (tileType === TileType.Mvt) return;

  throw new Error(`${TILE_TYPE_NAMES[tileType] ?? 'This'} PMTiles archive holds raster tiles, which cannot render as a vector tile overlay: ${url}`);
}

export function registerPmtilesArchive(app: App, url: string, register: ProtocolRegistrar): void {
  const vaultPath = pmtilesVaultPath(url);

  if (vaultPath !== undefined && !app.vault.getAbstractFileByPath(normalizePath(vaultPath))) {
    throw new Error(`No PMTiles archive at "${vaultPath}" in this vault.`);
  }

  installPmtilesProtocol(register);

  const protocol = protocolState.protocol!;

  if (protocol.tiles.has(pmtilesArchiveKey(url))) return;

  protocol.add(new PMTiles(vaultPath ? new VaultArchiveSource(app, url, vaultPath) : pmtilesArchiveKey(url)));
  logger.scope('Overlays').debug('pmtiles archive registered', { url, vault: Boolean(vaultPath) });
}
