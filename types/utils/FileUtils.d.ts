import { App } from 'obsidian';
export interface DownloadOptions {
    app?: App;
    content: string;
    filename: string;
    mimeType: string;
    desktopNotice?: string;
    mobileNotice?: string;
    vaultFallbackFolder?: string;
}
export type VaultPathCollisionStyle = 'hyphen' | 'parentheses';
export declare function downloadOrCopy(options: DownloadOptions): Promise<void>;
export declare const PLACES_EXPORTS_FOLDER = "Places Exports";
export declare function resolveNewNoteFolder(app: App, sourcePath?: string): string;
export declare function getAvailableVaultPath(app: App, path: string, collisionStyle?: VaultPathCollisionStyle): string;
export declare function ensureVaultFolder(app: App, filePath: string): Promise<void>;
export declare function copyToClipboard(text: string, notice?: string): Promise<void>;
