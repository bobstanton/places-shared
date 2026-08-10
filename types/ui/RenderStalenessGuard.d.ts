import { MarkdownRenderChild } from "obsidian";
export declare class RenderStalenessGuard extends MarkdownRenderChild {
    superseded: boolean;
    onunload(): void;
}
