import { App, MarkdownPostProcessorContext } from "obsidian";
import type { GeoJSON } from "geojson";
import type { ImageAlignmentProcessor, ImageAlignmentServices } from "../services/index";
export declare function buildImageAlignment(app: App, _providerName: string, getStyleUrl: (style?: string) => string): ImageAlignmentProcessor;
export declare class MapLibreImageAlignmentProcessor {
    private app;
    private getStyleUrl;
    constructor(app: App, getStyleUrl: (style?: string) => string);
    process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, services?: ImageAlignmentServices): void;
}
export declare function collectAlignmentReferenceLines(value: GeoJSON, lines: [number, number][][]): void;
