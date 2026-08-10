export interface MapCameraGuard {
    beginProgrammaticMove(): () => void;
    isProgrammaticMove(): boolean;
}
export interface MapCameraGuardOptions {
    staleReleaseMs?: number;
    setTimeout?: (fn: () => void, ms: number) => unknown;
    clearTimeout?: (id: unknown) => void;
}
export declare function createMapCameraGuard(options?: MapCameraGuardOptions): MapCameraGuard;
