export interface RuntimeDebugCompatibility {
    globalFlag?: string;
    storageKey?: string;
}
export declare function isRuntimeDebugEnabled(channel: string, compatibility?: RuntimeDebugCompatibility): boolean;
export declare function logRuntimeDebug(channel: string, stage: string, payload?: Record<string, unknown>, options?: RuntimeDebugCompatibility & {
    scope?: string;
}): void;
