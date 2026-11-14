export declare function finishWork<T>(work: Generator<void, T>): T;
export declare function runCooperativeWork<T>(work: Generator<void, T>, signal?: AbortSignal): Promise<T>;
export declare class CooperativeWorkQueue {
    private jobs;
    private active;
    run<T>(create: () => Generator<void, T>, signal: AbortSignal): Promise<T>;
    private drain;
}
