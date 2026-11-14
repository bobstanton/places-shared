export interface RenderOwner {
    register(cleanup: () => void): void;
}
export interface BlockRenderContext {
    sourcePath: string;
}
export declare class RenderLifetime implements RenderOwner {
    private cleanups;
    private children;
    private loaded;
    register(cleanup: () => void): void;
    load(): void;
    unload(): void;
    addChild<T extends RenderLifetime>(child: T): T;
    removeChild(child: RenderLifetime): void;
    onload(): void;
    onunload(): void;
}
export type RenderApplication = unknown;
