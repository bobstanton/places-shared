export interface TextLayerOptions {
    sourceId: string;
    defaultColor?: string;
    layerId?: string;
    textOverlap?: "never" | "always" | "cooperative";
    variableAnchorOffsets?: unknown[];
}
export declare function createTextLayerConfig(options: TextLayerOptions): import("./TextLabelLayerStyles").PointLabelLayerConfig;
