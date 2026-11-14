export declare const DEVICE_POSITION_TRACKING_ZOOM = 15;
export interface DevicePositionWatchOptions {
    readonly enableHighAccuracy: boolean;
    readonly timeout: number;
    readonly maximumAge: number;
}
export declare const DEVICE_POSITION_OPTIONS: Readonly<DevicePositionWatchOptions>;
export interface DevicePositionCoordinate {
    readonly latitude: number;
    readonly longitude: number;
}
export interface DevicePositionError {
    readonly code: number;
}
export interface DevicePositionSource {
    watchPosition(success: (coordinate: DevicePositionCoordinate) => void, error: (error: DevicePositionError) => void, options: Readonly<DevicePositionWatchOptions>): number;
    clearWatch(watchId: number): void;
}
export interface DevicePositionState {
    readonly tracking: boolean;
    readonly locked: boolean;
}
export interface DevicePositionControllerCallbacks {
    currentZoom(): number;
    positionChanged(coordinate: DevicePositionCoordinate): void;
    positionRemoved(): void;
    recenter(coordinate: DevicePositionCoordinate, zoom?: number): void;
    stateChanged(state: DevicePositionState): void;
    error(message: string, error?: unknown): void;
}
export interface DevicePositionControllerOptions {
    readonly source?: DevicePositionSource;
    readonly callbacks: DevicePositionControllerCallbacks;
    readonly trackingZoom?: number;
}
export declare function devicePositionErrorMessage(error: DevicePositionError): string;
export declare class DevicePositionController {
    private readonly source?;
    private readonly callbacks;
    private readonly trackingZoom;
    private watchId;
    private tracking;
    private locked;
    private zoomOnNextRecenter;
    private lastPosition;
    private lastErrorCode;
    constructor(options: DevicePositionControllerOptions);
    getState(): DevicePositionState;
    toggle(): void;
    userMoved(): void;
    dispose(): void;
    private startTracking;
    private stopTracking;
    private lock;
    private updatePosition;
    private recenter;
    private handleError;
    private emitState;
}
