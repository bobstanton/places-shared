export const DEVICE_POSITION_TRACKING_ZOOM = 15;

export interface DevicePositionWatchOptions {
  readonly enableHighAccuracy: boolean;
  readonly timeout: number;
  readonly maximumAge: number;
}

export const DEVICE_POSITION_OPTIONS: Readonly<DevicePositionWatchOptions> = Object.freeze({
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 5_000,
});

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

export function devicePositionErrorMessage(error: DevicePositionError): string {
  switch (error.code) {
    case 1:
      return 'Location permission denied';
    case 2:
      return 'Location information unavailable';
    case 3:
      return 'Location request timed out';
    default:
      return 'Failed to get location';
  }
}

export class DevicePositionController {
  private readonly source?: DevicePositionSource;
  private readonly callbacks: DevicePositionControllerCallbacks;
  private readonly trackingZoom: number;
  private watchId: number | null = null;
  private tracking = false;
  private locked = false;
  private zoomOnNextRecenter = false;
  private lastPosition: DevicePositionCoordinate | null = null;
  private lastErrorCode: number | null = null;

  constructor(options: DevicePositionControllerOptions) {
    this.source = options.source;
    this.callbacks = options.callbacks;
    this.trackingZoom = options.trackingZoom ?? DEVICE_POSITION_TRACKING_ZOOM;
  }

  getState(): DevicePositionState {
    return { tracking: this.tracking, locked: this.locked };
  }

  toggle(): void {
    if (!this.tracking) {
      this.startTracking();

      return;
    }

    if (!this.locked) {
      this.lock();
      this.recenter();

      return;
    }

    this.stopTracking();
  }

  userMoved(): void {
    if (!this.locked) return;
    this.locked = false;
    this.emitState();
  }

  dispose(): void {
    this.stopTracking();
  }

  private startTracking(): void {
    if (!this.source) {
      this.callbacks.error('Location services are not available');

      return;
    }

    this.tracking = true;
    this.lastErrorCode = null;
    this.lock();

    try {
      const watchId = this.source.watchPosition(
        coordinate => this.updatePosition(coordinate),
        error => this.handleError(error),
        DEVICE_POSITION_OPTIONS,
      );

      if (this.tracking) this.watchId = watchId;
      else this.source.clearWatch(watchId);
    } catch (error) {
      this.stopTracking();
      this.callbacks.error('Failed to get location', error);
    }
  }

  private stopTracking(): void {
    const watchId = this.watchId;

    this.watchId = null;
    if (watchId !== null) this.source?.clearWatch(watchId);

    const hadPosition = this.lastPosition !== null;

    this.tracking = false;
    this.locked = false;
    this.zoomOnNextRecenter = false;
    this.lastPosition = null;
    this.lastErrorCode = null;
    if (hadPosition) this.callbacks.positionRemoved();
    this.emitState();
  }

  private lock(): void {
    this.locked = true;
    this.zoomOnNextRecenter = true;
    this.emitState();
  }

  private updatePosition(coordinate: DevicePositionCoordinate): void {
    this.lastPosition = coordinate;
    this.lastErrorCode = null;
    this.callbacks.positionChanged(coordinate);
    if (this.locked) this.recenter();
  }

  private recenter(): void {
    if (!this.lastPosition) return;
    const zoom = this.zoomOnNextRecenter
      ? Math.max(this.callbacks.currentZoom(), this.trackingZoom)
      : undefined;

    this.zoomOnNextRecenter = false;
    this.callbacks.recenter(this.lastPosition, zoom);
  }

  private handleError(error: DevicePositionError): void {
    if (this.lastErrorCode !== error.code) {
      this.lastErrorCode = error.code;
      this.callbacks.error(devicePositionErrorMessage(error), error);
    }

    if (error.code === 1) this.stopTracking();
  }

  private emitState(): void {
    this.callbacks.stateChanged(this.getState());
  }
}
