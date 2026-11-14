import { App, MarkdownPostProcessorContext } from "obsidian";
import { type MapSourceContext } from "../../settings/index";
import { type ControlPointAlignment } from './ImageAlignmentControlPoints';
export interface ImageOverlayAlignmentCorner {
    lat: number;
    lng: number;
}
export type ImageOverlayAlignmentCorners = {
    nw: ImageOverlayAlignmentCorner;
    ne: ImageOverlayAlignmentCorner;
    se: ImageOverlayAlignmentCorner;
    sw: ImageOverlayAlignmentCorner;
};
export declare function imageOverlayAlignmentSessionKey(source: MapSourceContext, image: string): string;
export declare function getImageOverlayAlignmentSessionCorners(key: string): ImageOverlayAlignmentCorners | undefined;
export declare function setImageOverlayAlignmentSessionCorners(key: string, corners: ImageOverlayAlignmentCorners): void;
export interface ImageOverlayAlignmentSettings {
    image?: string;
    height?: string;
    style?: string;
    opacity?: number;
    initialZoom?: number;
    initialCenter?: [number, number];
    initialCorners?: ImageOverlayAlignmentCorners;
    referenceOverlays?: unknown[];
    alignment?: ControlPointAlignment;
}
export interface ImageAlignmentMarker {
    setLngLat(position: [number, number]): void;
    getLngLat(): ImageOverlayAlignmentCorner;
    on(type: 'drag' | 'dragend', handler: () => void): void;
    remove?(): void;
    setDraggable?(draggable: boolean): void;
}
export interface ImageAlignmentPointerEvent {
    lngLat: ImageOverlayAlignmentCorner;
    originalEvent: MouseEvent;
    readonly defaultPrevented: boolean;
    preventDefault(): void;
}
export interface ImageAlignmentWheelEvent {
    originalEvent: WheelEvent;
    preventDefault(): void;
}
export interface ImageAlignmentMapEventMap {
    load: unknown;
    click: ImageAlignmentPointerEvent;
    mousedown: ImageAlignmentPointerEvent;
    mousemove: ImageAlignmentPointerEvent;
    wheel: ImageAlignmentWheelEvent;
}
export interface ImageAlignmentMap {
    on<K extends keyof ImageAlignmentMapEventMap>(type: K, handler: (event: ImageAlignmentMapEventMap[K]) => void): void;
    resize(): void;
    getCanvas(): HTMLCanvasElement;
    unproject(point: [number, number]): ImageOverlayAlignmentCorner;
    project(point: ImageOverlayAlignmentCorner): {
        x: number;
        y: number;
    };
    addImageOverlay(imageUrl: string, coordinates: ImageOverlayCoordinates, opacity: number): void;
    updateImageOverlay(coordinates: ImageOverlayCoordinates): void;
    setImageVisible?(visible: boolean): void;
    setPointMatching?(matching: boolean): void;
    getReferenceLines?(): readonly (readonly [number, number][])[];
    createMarker(position: ImageOverlayAlignmentCorner, element: HTMLElement): ImageAlignmentMarker;
    fitBounds(corners: ImageOverlayAlignmentCorners): void;
    remove(): void;
    zoomIn?(): void;
    zoomOut?(): void;
    addReferenceOverlays?(definitions: readonly unknown[], sourcePath: string): Promise<readonly {
        path: string;
        error: string;
    }[]>;
}
export type ImageOverlayCoordinates = [[number, number], [number, number], [number, number], [number, number]];
export interface ImageOverlayAlignmentAdapter {
    formatDistance?: (meters: number) => string;
    createMap(container: HTMLElement, settings: ImageOverlayAlignmentSettings): ImageAlignmentMap;
    missingConfiguration?: {
        title: string;
        message: string;
    };
    showZoomButtons?: boolean;
}
export interface MapGlAlignmentMapLike {
    on<K extends keyof ImageAlignmentMapEventMap>(type: K, handler: (event: ImageAlignmentMapEventMap[K]) => void): void;
    resize(): void;
    remove(): void;
    getCanvas(): HTMLCanvasElement;
    unproject(point: [number, number]): ImageOverlayAlignmentCorner;
    project(point: ImageOverlayAlignmentCorner): {
        x: number;
        y: number;
    };
    addSource(id: string, source: {
        type: 'image';
        url: string;
        coordinates: ImageOverlayCoordinates;
    }): void;
    addLayer(layer: {
        id: string;
        type: 'raster';
        source: string;
        paint: {
            'raster-opacity': number;
            'raster-fade-duration': number;
        };
    }): void;
    setLayoutProperty?(layer: string, name: string, value: string): void;
    getSource(id: string): {
        setCoordinates(coordinates: ImageOverlayCoordinates): void;
    } | undefined;
    fitBounds(bounds: unknown, options: {
        padding: number;
        animate: boolean;
    }): void;
    zoomIn?(options: {
        duration: number;
    }): void;
    zoomOut?(options: {
        duration: number;
    }): void;
}
export interface MapGlMarkerLike extends ImageAlignmentMarker {
    setLngLat(position: [number, number]): MapGlMarkerLike;
    addTo(map: MapGlAlignmentMapLike): ImageAlignmentMarker;
}
export type MapGlMarkerConstructor = new (options: {
    element: HTMLElement;
    draggable: true;
    anchor: 'center';
}) => MapGlMarkerLike;
export type MapGlBoundsConstructor = new () => {
    extend(position: [number, number]): void;
};
export declare function createMapGlImageAlignmentMap(map: MapGlAlignmentMapLike, MarkerCtor: MapGlMarkerConstructor, BoundsCtor: MapGlBoundsConstructor): ImageAlignmentMap;
export declare class ImageOverlayAlignmentRunner {
    private app;
    private adapter;
    constructor(app: App, adapter: ImageOverlayAlignmentAdapter);
    process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void;
    private loadImageResource;
    private addButton;
}
export declare function rectifyImageOverlayCorners(map: Pick<ImageAlignmentMap, 'project' | 'unproject'>, corners: ImageOverlayAlignmentCorners, aspectRatio: number): ImageOverlayAlignmentCorners;
export declare function parseImageOverlayAlignmentSettings(source: string): ImageOverlayAlignmentSettings;
export declare function parseImageOverlayCoordinates(value: string): ImageOverlayAlignmentCorners | undefined;
export declare function formatImageOverlayAlignmentOutput(image: string, corners: ImageOverlayAlignmentCorners): string;
export declare function cornersToCoordinates(corners: ImageOverlayAlignmentCorners): ImageOverlayCoordinates;
