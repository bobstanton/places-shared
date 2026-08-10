export interface MapRecoveryState {
  rehydrate?: () => Promise<void> | void;
  cleanup?: () => void;
  hasActiveInstance?: () => boolean;
  contextLost?: boolean;
  suppressContextLoss?: boolean;
}

interface MapRecoveryContainer extends HTMLElement {
  _placesMapRecoveryState?: MapRecoveryState;
}

export function getMapRecoveryState(container: HTMLElement): MapRecoveryState | undefined {
  return (container as MapRecoveryContainer)._placesMapRecoveryState;
}

export function setMapRecoveryState(container: HTMLElement, state: Partial<MapRecoveryState>): void {
  const el = container as MapRecoveryContainer;
  el._placesMapRecoveryState = { ...(el._placesMapRecoveryState || {}), ...state };
}

export function clearMapRecoveryState(container: HTMLElement): void {
  container.removeClass('places-map-context-lost');
  container.querySelector('.places-webgl-error-overlay')?.remove();
  delete (container as MapRecoveryContainer)._placesMapRecoveryState;
}

export function markMapContextLost(container: HTMLElement): void {
  setMapRecoveryState(container, { contextLost: true });
}

export function markMapContextRestored(container: HTMLElement): void {
  container.removeClass('places-map-context-lost');
  container.querySelector('.places-webgl-error-overlay')?.remove();
  setMapRecoveryState(container, { contextLost: false });
}

export function setMapContextLossSuppressed(container: HTMLElement, suppressed: boolean): void {
  setMapRecoveryState(container, { suppressContextLoss: suppressed });
}

export function suppressMapContextLossDuring(container: HTMLElement, callback: () => void, suppressForMs: number = 1000): void {
  setMapContextLossSuppressed(container, true);

  try {
    callback();
  } finally {
    window.setTimeout(() => {
      if (getMapRecoveryState(container)) {
        setMapContextLossSuppressed(container, false);
      }
    }, suppressForMs);
  }
}
