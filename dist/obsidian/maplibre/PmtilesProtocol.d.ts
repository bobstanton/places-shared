import { type App } from "obsidian";
import type * as maplibregl from "maplibre-gl";
import { type RangeResponse, type Source } from "pmtiles";
export type ProtocolRegistrar = (customProtocol: string, loadFn: maplibregl.AddProtocolAction) => void;
export declare class VaultArchiveSource implements Source {
    private readonly app;
    private readonly url;
    private readonly vaultPath;
    private whole?;
    constructor(app: App, url: string, vaultPath: string);
    getKey(): string;
    getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse>;
    private readRange;
}
export declare function installPmtilesProtocol(register: ProtocolRegistrar): void;
export declare function assertVectorPmtilesArchive(url: string): Promise<void>;
export declare function registerPmtilesArchive(app: App, url: string, register: ProtocolRegistrar): void;
