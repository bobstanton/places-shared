export interface MapSearchToggle {
    toggle: () => void;
    isVisible: () => boolean;
    onCloseCallback?: () => void;
}
export interface MapGeocodingToggle {
    toggle: () => void;
    isVisible: () => boolean;
    onCloseCallback?: () => void;
}
export interface MapContainerState {
    geocodingToggle?: MapGeocodingToggle;
    providerStates?: Record<string, unknown>;
    searchResultMarkers?: unknown[];
}
export interface MapProviderLifecycle {
    cleanup: () => void;
    hasActiveInstance: () => boolean;
}
export interface MapProviderStateWithLifecycle {
    lifecycle?: MapProviderLifecycle;
}
export declare function getMapContainerState(container: HTMLElement): MapContainerState | undefined;
export declare function setMapContainerState(container: HTMLElement, state: Partial<MapContainerState>): void;
export declare function getMapProviderState<T>(container: HTMLElement, providerId: string): T | undefined;
export declare function setMapProviderState<T>(container: HTMLElement, providerId: string, state: T): void;
export declare function clearMapProviderState(container: HTMLElement, providerId: string): void;
export declare function getAllMapProviderStates(container: HTMLElement): unknown[];
export declare function cleanupMapProviderStates(container: HTMLElement, onError?: (error: unknown) => void): void;
export declare function hasActiveMapProviderState(container: HTMLElement): boolean;
