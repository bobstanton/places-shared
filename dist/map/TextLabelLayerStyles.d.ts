export declare const DEFAULT_MAP_LABEL_COLOR = "#d73027";
export declare const DEFAULT_ROUTE_LABEL_COLOR = "#d73027";
export declare const WAYPOINT_EMOJI_SIZE_PX = 20;
export declare function createMapLabelPaint(defaultColor?: string): Record<string, unknown>;
export declare const POINT_LABEL_VARIABLE_ANCHORS: readonly ["left", "right", "bottom", "top"];
export interface PointLabelLayerOptions {
    sourceId: string;
    layerId?: string;
    filter?: unknown;
    textField?: unknown;
    defaultColor?: string;
    textOverlap?: 'never' | 'always' | 'cooperative';
    variableAnchorOffsets?: unknown[];
}
export interface PointLabelLayerConfig {
    id: string;
    type: 'symbol';
    source: string;
    filter?: unknown;
    layout: Record<string, unknown>;
    paint: Record<string, unknown>;
}
export declare function createPointLabelLayerConfig(options: PointLabelLayerOptions): PointLabelLayerConfig;
export declare function createRouteLabelPaint(defaultColor?: string): Record<string, unknown>;
export declare function createRouteLabelLayerConfig(options: {
    sourceId: string;
    layerId?: string;
    defaultColor?: string;
}): Record<string, unknown>;
export declare function createRouteEndpointLabelLayerConfig(options: {
    sourceId: string;
    layerId?: string;
    defaultColor?: string;
}): Record<string, unknown>;
export declare function createWaypointLayerConfig(options: {
    sourceId: string;
    layerId?: string;
    trackColor: string;
    excludeProperties?: readonly string[];
    filter?: unknown;
    defaultRadius?: unknown;
    defaultOpacity?: unknown;
    defaultStrokeColor?: unknown;
    defaultStrokeWidth?: unknown;
}): Record<string, unknown>;
export declare function createWaypointEmojiLayerConfig(options: {
    sourceId: string;
    layerId?: string;
    excludeProperties?: readonly string[];
    filter?: unknown;
    defaultOpacity?: unknown;
}): Record<string, unknown>;
export declare function createWaypointLabelLayerConfig(options: {
    sourceId: string;
    layerId?: string;
    defaultColor?: string;
    excludeProperties?: readonly string[];
}): PointLabelLayerConfig;
export declare function createPathLabelLayerConfig(options: {
    sourceId: string;
    layerId?: string;
    defaultColor?: string;
}): Record<string, unknown>;
