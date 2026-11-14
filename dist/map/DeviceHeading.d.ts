type CompassEvent = DeviceOrientationEvent & {
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
};
export declare function deviceCompassHeading(event: CompassEvent, screenAngle?: number): number | null;
export declare function createDeviceHeadingWatch(window: Window | null, changed: (heading: number | null) => void): {
    start(): void;
    stop(): void;
};
export {};
