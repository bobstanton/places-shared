export declare const PMTILES_PROTOCOL = "pmtiles";
export declare const PMTILES_VAULT_PREFIX = "pmtiles://vault/";
export declare function pmtilesVaultUrl(vaultPath: string): string;
export declare function pmtilesRemoteUrl(url: string | undefined): string | undefined;
export declare function isPmtilesUrl(url: string): boolean;
export declare function pmtilesVaultPath(url: string): string | undefined;
export declare function pmtilesArchiveKey(url: string): string;
export declare function isPmtilesPath(path: string): boolean;
