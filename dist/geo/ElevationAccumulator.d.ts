export declare const ELEVATION_NOISE_M = 1;
export declare class ElevationAccumulator {
    private readonly noiseFloorM;
    private gain;
    private loss;
    private reference;
    constructor(noiseFloorM?: number);
    add(elevation: number | undefined): void;
    get gainM(): number;
    get lossM(): number;
}
