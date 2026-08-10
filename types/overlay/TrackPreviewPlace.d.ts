import { MapPlace } from '../Place';
export interface PreviewTrack {
    name: string;
    icon: string;
    coordinates: number[][];
    color: string;
    lineStyle: 'solid' | 'dashed';
    filePath?: string;
}
export declare function buildTrackPreviewPlace(track: PreviewTrack): MapPlace;
