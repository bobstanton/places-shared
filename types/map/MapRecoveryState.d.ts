export interface MapRecoveryState {
    rehydrate?: () => Promise<void> | void;
    cleanup?: () => void;
    hasActiveInstance?: () => boolean;
    contextLost?: boolean;
    suppressContextLoss?: boolean;
}
export declare function getMapRecoveryState(container: HTMLElement): MapRecoveryState | undefined;
export declare function setMapRecoveryState(container: HTMLElement, state: Partial<MapRecoveryState>): void;
export declare function clearMapRecoveryState(container: HTMLElement): void;
export declare function markMapContextLost(container: HTMLElement): void;
export declare function markMapContextRestored(container: HTMLElement): void;
export declare function setMapContextLossSuppressed(container: HTMLElement, suppressed: boolean): void;
export declare function suppressMapContextLossDuring(container: HTMLElement, callback: () => void, suppressForMs?: number): void;
