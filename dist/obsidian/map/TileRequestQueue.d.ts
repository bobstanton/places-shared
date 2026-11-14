import type { TileCacheFetchResult } from './TileCache';
export declare class TileRequestQueue {
    private jobs;
    private hosts;
    private queued;
    private recoveryListeners;
    onRecovery(listener: (host: string) => void): () => void;
    get pendingCount(): number;
    hasPending(key: string): boolean;
    retryNow(url: string): void;
    isDegraded(url: string): boolean;
    request(key: string, url: string, fetcher: () => Promise<TileCacheFetchResult>, signal?: AbortSignal, onSuccess?: (value: TileCacheFetchResult) => void): Promise<TileCacheFetchResult>;
    private host;
    private pump;
    private timeout;
    private failed;
    private reject;
    private remove;
}
