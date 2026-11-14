export interface MapRecoveryState {
    rehydrate?: () => Promise<void> | void;
}
export declare function getMapRecoveryState(container: HTMLElement): MapRecoveryState | undefined;
export declare function setMapRecoveryState(container: HTMLElement, state: MapRecoveryState): void;
export declare function clearMapRecoveryState(container: HTMLElement): void;
export declare function markMapContextRestored(container: HTMLElement): void;
