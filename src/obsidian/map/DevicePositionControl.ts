import { Notice, setIcon } from 'obsidian';
import { createDeviceHeadingWatch } from '../../map/DeviceHeading';
import { DevicePositionController, type DevicePositionCoordinate, type DevicePositionSource, type DevicePositionState } from '../../map/index';
import { logger } from '../../utils/index';

export interface DevicePositionMapAdapter {
  currentZoom(): number;
  positionChanged(coordinate: DevicePositionCoordinate): void;
  positionRemoved(): void;
  headingChanged(heading: number | null): void;
  recenter(coordinate: DevicePositionCoordinate, zoom?: number): void;
  onUserMoveStart(handler: () => void): () => void;
}

export interface DevicePositionControlOptions {
  readonly button: HTMLButtonElement;
  readonly adapter: DevicePositionMapAdapter;
  readonly geolocation?: Pick<Geolocation, 'watchPosition' | 'clearWatch'>;
  readonly notify?: (message: string) => void;
}

export interface DevicePositionControlHandle {
  dispose(): void;
}

export function createBrowserDevicePositionSource(geolocation: Pick<Geolocation, 'watchPosition' | 'clearWatch'> | undefined): DevicePositionSource | undefined {
  if (!geolocation) return undefined;

  return {
    watchPosition: (success, error, options) => geolocation.watchPosition(
      position => success({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      error,
      options,
    ),
    clearWatch: watchId => geolocation.clearWatch(watchId),
  };
}

function renderButtonState(button: HTMLButtonElement, state: DevicePositionState): void {
  button.classList.toggle('is-active', state.tracking);
  button.setAttribute('aria-pressed', String(state.tracking));

  if (!state.tracking) {
    setIcon(button, 'locate-fixed');
    button.setAttribute('aria-label', 'Show current device position');
  } else if (state.locked) {
    setIcon(button, 'locate-fixed');
    button.setAttribute('aria-label', 'Stop showing current device position');
  } else {
    setIcon(button, 'locate');
    button.setAttribute('aria-label', 'Center on current device position');
  }

  button.setAttribute('title', button.getAttribute('aria-label') ?? 'Current device position');
}

export function attachDevicePositionControl(options: DevicePositionControlOptions): DevicePositionControlHandle {
  const { button, adapter } = options;

  button.type = 'button';
  button.classList.add('places-device-position-button');

  const heading = createDeviceHeadingWatch(button.ownerDocument.defaultView, value => adapter.headingChanged(value));
  const controller = new DevicePositionController({
    source: createBrowserDevicePositionSource(options.geolocation),
    callbacks: {
      currentZoom: () => adapter.currentZoom(),
      positionChanged: coordinate => adapter.positionChanged(coordinate),
      positionRemoved: () => adapter.positionRemoved(),
      recenter: (coordinate, zoom) => adapter.recenter(coordinate, zoom),
      stateChanged: state => {
        renderButtonState(button, state);

        if (state.tracking) heading.start();
        else heading.stop();
      },
      error: (message, error) => {
        (options.notify ?? (text => { new Notice(text); }))(message);
        logger.scope('DevicePosition').warn(message, error);
      },
    },
  });

  renderButtonState(button, controller.getState());

  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    controller.toggle();
  };

  button.addEventListener('click', onClick);
  const stopListeningForMovement = adapter.onUserMoveStart(() => controller.userMoved());

  return {
    dispose: () => {
      stopListeningForMovement();
      button.removeEventListener('click', onClick);
      controller.dispose();
    },
  };
}

export function createDevicePositionMarkerElement(): HTMLElement {
  const marker = createDiv('places-device-position-marker');

  marker.setAttribute('aria-label', 'Current device position');
  const arrow = createSpan('places-device-position-marker-heading');

  arrow.setAttribute('aria-hidden', 'true');
  const dot = createSpan('places-device-position-marker-dot');

  marker.append(arrow, dot);

  return marker;
}

export function updateDevicePositionMarkerHeading(element: HTMLElement, heading: number | null, mapBearing = 0): void {
  const available = heading !== null && Number.isFinite(heading);

  element.classList.toggle('has-heading', available);
  const description = available ? `Current device position, bearing ${Math.round(heading) % 360}°` : 'Current device position';

  element.setAttribute('aria-label', description);
  element.setAttribute('title', description);
  const arrow = element.querySelector<HTMLElement>('.places-device-position-marker-heading');

  if (arrow) arrow.style.transform = `rotate(${available ? heading - mapBearing : 0}deg)`;
}
