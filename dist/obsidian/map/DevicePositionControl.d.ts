import { type DevicePositionCoordinate, type DevicePositionSource } from '../../map/index';
export interface DevicePositionMapAdapter {
    currentZoom(): number;
    positionChanged(coordinate: DevicePositionCoordinate): void;
    positionRemoved(): void;
    headingChanged(heading: number | null): void;
    recenter(coordinate: DevicePositionCoordinate, zoom?: number): void;
    onUserMoveStart(handler: () => void): () => void;
}
export interface DevicePositionControlOptions {
    readonly button: HTMLButtonElement;
    readonly adapter: DevicePositionMapAdapter;
    readonly geolocation?: Pick<Geolocation, 'watchPosition' | 'clearWatch'>;
    readonly notify?: (message: string) => void;
}
export interface DevicePositionControlHandle {
    dispose(): void;
}
export declare function createBrowserDevicePositionSource(geolocation: Pick<Geolocation, 'watchPosition' | 'clearWatch'> | undefined): DevicePositionSource | undefined;
export declare function attachDevicePositionControl(options: DevicePositionControlOptions): DevicePositionControlHandle;
export declare function createDevicePositionMarkerElement(): HTMLElement;
export declare function updateDevicePositionMarkerHeading(element: HTMLElement, heading: number | null, mapBearing?: number): void;
