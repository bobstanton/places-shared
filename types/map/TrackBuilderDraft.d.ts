import type { MapSourceContext } from '../settings/MapConfiguration';
import type { TrackData } from '../geo/TrackTypes';
export type TrackBuilderCoordinate = readonly [longitude: number, latitude: number];
export interface TrackBuilderLinePosition {
    readonly segmentIndex: number;
    readonly t: number;
}
export interface TrackBuilderSectionEndpoint {
    readonly sectionId: string;
    readonly endpoint: 'start' | 'end';
}
export interface TrackBuilderPointMetadata {
    readonly elevationMeters?: number;
    readonly time?: string;
    readonly gpxInnerXml?: string;
}
export interface TrackBuilderSection {
    readonly id: string;
    readonly coordinates: readonly TrackBuilderCoordinate[];
    readonly layerId: string;
    readonly sourceLayer?: string;
    readonly featureId?: string | number;
    readonly sourceFeatureKey?: string;
    readonly name?: string;
    readonly sourceProperties?: Readonly<Record<string, unknown>>;
    readonly sourceCoordinates?: readonly TrackBuilderCoordinate[];
    readonly pointMetadata?: readonly (TrackBuilderPointMetadata | undefined)[];
    readonly sourcePointMetadata?: readonly (TrackBuilderPointMetadata | undefined)[];
    readonly startPosition?: TrackBuilderLinePosition;
    readonly endPosition?: TrackBuilderLinePosition;
    readonly startCoordinateOverride?: TrackBuilderCoordinate;
    readonly endCoordinateOverride?: TrackBuilderCoordinate;
    readonly breakBefore?: boolean;
}
export interface TrackBuilderWaypoint {
    readonly id: string;
    readonly coordinate: TrackBuilderCoordinate;
    readonly name?: string;
    readonly symbol?: string;
    readonly description?: string;
    readonly gpxInnerXml?: string;
}
export interface TrackBuilderDraft {
    readonly sections: readonly TrackBuilderSection[];
    readonly waypoints?: readonly TrackBuilderWaypoint[];
}
export interface TrackBuilderHistory {
    readonly draft: TrackBuilderDraft;
    readonly undo: readonly TrackBuilderDraft[];
    readonly redo: readonly TrackBuilderDraft[];
}
export interface ParsedTrackBuilderGpx {
    readonly name?: string;
    readonly sections: readonly TrackBuilderSection[];
    readonly waypoints: readonly TrackBuilderWaypoint[];
}
export declare function trackDataToTrackBuilderSections(track: TrackData): readonly TrackBuilderSection[];
export declare function trackBuilderDraftKey(source: MapSourceContext, id?: string): string;
export declare function getTrackBuilderHistory(key: string): TrackBuilderHistory;
export declare function appendTrackBuilderSection(key: string, section: TrackBuilderSection): TrackBuilderHistory;
export declare function prependTrackBuilderSection(key: string, section: TrackBuilderSection): TrackBuilderHistory;
export declare function appendTrackBuilderSections(key: string, sections: readonly TrackBuilderSection[]): TrackBuilderHistory;
export declare function prependTrackBuilderSections(key: string, sections: readonly TrackBuilderSection[]): TrackBuilderHistory;
export declare function removeLastTrackBuilderSection(key: string): TrackBuilderHistory;
export declare function removeTrackBuilderSection(key: string, sectionId: string): TrackBuilderHistory;
export declare function replaceTrackBuilderSection(key: string, section: TrackBuilderSection): TrackBuilderHistory;
export declare function replaceTrackBuilderSections(key: string, sections: readonly TrackBuilderSection[]): TrackBuilderHistory;
export declare function replaceTrackBuilderContent(key: string, sections: readonly TrackBuilderSection[], waypoints: readonly TrackBuilderWaypoint[]): TrackBuilderHistory;
export declare function reverseTrackBuilderSection(section: TrackBuilderSection): TrackBuilderSection;
export interface TrackBuilderPiece {
    readonly startIndex: number;
    endIndex: number;
}
export declare function trackBuilderPieces(sections: readonly TrackBuilderSection[], joinToleranceMeters?: number): TrackBuilderPiece[];
export declare function insertDirectTrackBuilderSection(key: string, section: TrackBuilderSection, anchor?: TrackBuilderSectionEndpoint, destination?: TrackBuilderSectionEndpoint): TrackBuilderHistory;
export declare function clearTrackBuilderDraft(key: string): TrackBuilderHistory;
export declare function trackBuilderWaypoints(draft: TrackBuilderDraft): readonly TrackBuilderWaypoint[];
export declare function addTrackBuilderWaypoint(key: string, waypoint: TrackBuilderWaypoint): TrackBuilderHistory;
export declare function updateTrackBuilderWaypoint(key: string, waypoint: TrackBuilderWaypoint): TrackBuilderHistory;
export declare function removeTrackBuilderWaypoint(key: string, waypointId: string): TrackBuilderHistory;
export declare function undoTrackBuilderEdit(key: string): TrackBuilderHistory;
export declare function redoTrackBuilderEdit(key: string): TrackBuilderHistory;
export declare function trackBuilderSegments(draft: TrackBuilderDraft, joinToleranceMeters?: number): TrackBuilderCoordinate[][];
export declare function serializeTrackBuilderGpx(draft: TrackBuilderDraft, name: string): string;
export declare function parseTrackBuilderGpx(content: string): ParsedTrackBuilderGpx;
export declare function trackDataToTrackBuilderWaypoints(track: TrackData): readonly TrackBuilderWaypoint[];
export declare function trackBuilderSectionPointMetadata(section: TrackBuilderSection): readonly (TrackBuilderPointMetadata | undefined)[];
export declare function trackBuilderMetadataAtPosition(metadata: readonly (TrackBuilderPointMetadata | undefined)[], position: TrackBuilderLinePosition): TrackBuilderPointMetadata | undefined;
