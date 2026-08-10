import { App, TFile } from 'obsidian';
export interface CreateOverlayNoteOptions {
    name: string;
    sourcePath?: string;
    frontmatter: Record<string, unknown>;
    body?: string;
    openAfterCreate?: boolean;
}
export declare function overlayNoteBody(): string;
export declare function createOverlayNote(app: App, options: CreateOverlayNoteOptions): Promise<TFile>;
