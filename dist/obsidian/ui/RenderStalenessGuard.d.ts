import { MarkdownRenderChild } from "obsidian";
export declare class RenderStalenessGuard extends MarkdownRenderChild {
    private readonly sourcePath?;
    superseded: boolean;
    constructor(containerEl: HTMLElement, sourcePath?: string | undefined);
    onunload(): void;
}
