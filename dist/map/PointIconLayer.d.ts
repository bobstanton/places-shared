export interface PointIconLayoutOptions {
    image: unknown;
    size: unknown;
    rotate?: unknown;
    rotationAlignment?: 'map' | 'viewport';
    pitchAlignment?: 'map' | 'viewport';
}
export declare function createPointIconLayout(options: PointIconLayoutOptions): Record<string, unknown>;
