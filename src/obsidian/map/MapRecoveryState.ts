export interface MapRecoveryState {
  rehydrate?: () => Promise<void> | void;
}

interface MapRecoveryContainer extends HTMLElement {
  _placesMapRecoveryState?: MapRecoveryState;
}

export function getMapRecoveryState(container: HTMLElement): MapRecoveryState | undefined {
  return (container as MapRecoveryContainer)._placesMapRecoveryState;
}

export function setMapRecoveryState(container: HTMLElement, state: MapRecoveryState): void {
  (container as MapRecoveryContainer)._placesMapRecoveryState = state;
}

export function clearMapRecoveryState(container: HTMLElement): void {
  markMapContextRestored(container);
  delete (container as MapRecoveryContainer)._placesMapRecoveryState;
}

export function markMapContextRestored(container: HTMLElement): void {
  container.removeClass('places-map-context-lost');
  container.querySelector('.places-webgl-error-overlay')?.remove();
}
