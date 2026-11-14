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

interface MapStateContainer extends HTMLElement {
  _placesMapState?: MapContainerState;
}

export function getMapContainerState(container: HTMLElement): MapContainerState | undefined {
  return (container as MapStateContainer)._placesMapState;
}

export function setMapContainerState(container: HTMLElement, state: Partial<MapContainerState>): void {
  const el = container as MapStateContainer;

  el._placesMapState = {
    ...(el._placesMapState || {}),
    ...state,
    providerStates: {
      ...(el._placesMapState?.providerStates || {}),
      ...(state.providerStates || {})
    }
  };
}

export function getMapProviderState<T>(container: HTMLElement, providerId: string): T | undefined {
  return getMapContainerState(container)?.providerStates?.[providerId] as T | undefined;
}

export function setMapProviderState<T>(container: HTMLElement, providerId: string, state: T): void {
  setMapContainerState(container, {
    providerStates: {
      [providerId]: state
    }
  });
}

export function clearMapProviderState(container: HTMLElement, providerId: string): void {
  const state = getMapContainerState(container);

  if (!state?.providerStates) return;
  delete state.providerStates[providerId];
}

export function getAllMapProviderStates(container: HTMLElement): unknown[] {
  return Object.values(getMapContainerState(container)?.providerStates || {});
}

export function cleanupMapProviderStates(container: HTMLElement, onError?: (error: unknown) => void): void {
  const states = getAllMapProviderStates(container);

  for (const state of states) {
    const lifecycle = (state as MapProviderStateWithLifecycle | undefined)?.lifecycle;

    if (!lifecycle) continue;

    try {
      lifecycle.cleanup();
    } catch (error) {
      onError?.(error);
    }
  }

  const containerState = getMapContainerState(container);

  if (containerState?.providerStates) {
    containerState.providerStates = {};
  }
}

export function hasActiveMapProviderState(container: HTMLElement): boolean {
  return getAllMapProviderStates(container).some(state => {
    const lifecycle = (state as MapProviderStateWithLifecycle | undefined)?.lifecycle;

    return lifecycle?.hasActiveInstance() ?? false;
  });
}
