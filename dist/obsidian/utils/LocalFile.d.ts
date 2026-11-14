import { App, TFile } from 'obsidian';
export interface LocalFile {
    url: string;
    name: string;
    extension: string;
    file?: TFile;
    devicePath?: string;
}
export declare function resolveLocalFile(app: App, value: string, sourcePath?: string): LocalFile | null;
export declare function openLocalFile(app: App, linkPath: string, sourcePath?: string): void;
export declare function canOpenDevicePaths(app: App): boolean;
export declare function openInDefaultApp(app: App, path: string): Promise<void>;
export declare function canRevealDevicePaths(): boolean;
export declare function showInSystemExplorer(path: string): void;
export declare function configureResourceUrls(app: App | null): void;
export declare function resourceUrl(path: unknown, sourcePath?: string): string;
