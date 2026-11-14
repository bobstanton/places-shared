type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

type OrientationWindow = Window & {
  DeviceOrientationEvent?: { requestPermission?: (absolute?: boolean) => Promise<string> };
  orientation?: number;
};

export function deviceCompassHeading(event: CompassEvent, screenAngle = 0): number | null {
  if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
    if (typeof event.webkitCompassAccuracy === 'number' && event.webkitCompassAccuracy < 0) return null;

    return ((event.webkitCompassHeading + screenAngle) % 360 + 360) % 360;
  }

  if (!(event.absolute || event.type === 'deviceorientationabsolute') || event.alpha === null || !Number.isFinite(event.alpha)) return null;
  const radians = Math.PI / 180;
  const alpha = event.alpha * radians;
  const beta = (event.beta ?? 0) * radians;
  const gamma = (event.gamma ?? 0) * radians;
  const screen = screenAngle * radians;
  const x = Math.cos(alpha) * Math.cos(gamma) * Math.sin(screen)
    + (Math.cos(alpha) * Math.sin(gamma) * Math.sin(beta) - Math.sin(alpha) * Math.cos(beta)) * Math.cos(screen);
  const y = Math.sin(alpha) * Math.cos(gamma) * Math.sin(screen)
    + (Math.sin(alpha) * Math.sin(gamma) * Math.sin(beta) + Math.cos(alpha) * Math.cos(beta)) * Math.cos(screen);

  if (Math.hypot(x, y) < 0.001) return null;

  return (Math.atan2(x, y) / radians + 360) % 360;
}

export function createDeviceHeadingWatch(window: Window | null, changed: (heading: number | null) => void) {
  let active = false;
  let generation = 0;
  let lastEvent: CompassEvent | null = null;
  const host: OrientationWindow | null = window;
  const update = () => {
    if (active && lastEvent) changed(deviceCompassHeading(lastEvent, host?.screen.orientation?.angle ?? host?.orientation ?? 0));
  };
  const onOrientation = (event: DeviceOrientationEvent) => {
    if (!event.absolute && event.type !== 'deviceorientationabsolute'
      && typeof (event as CompassEvent).webkitCompassHeading !== 'number') return;

    lastEvent = event;
    update();
  };

  return {
    start(): void {
      if (active || !host) return;
      active = true;
      const token = ++generation;
      const listen = () => {
        if (!active || token !== generation) return;
        host.addEventListener('deviceorientation', onOrientation);
        host.addEventListener('deviceorientationabsolute', onOrientation as EventListener);
        host.addEventListener('orientationchange', update);
        host.screen.orientation?.addEventListener('change', update);
      };
      const orientation = host.DeviceOrientationEvent;

      if (orientation?.requestPermission) {
        try {
          void orientation.requestPermission(true).then(permission => {
            if (permission === 'granted') listen();
          }).catch(() => {   });
        } catch {
          return;
        }
      } else listen();
    },
    stop(): void {
      active = false;
      generation++;
      lastEvent = null;
      host?.removeEventListener('deviceorientation', onOrientation);
      host?.removeEventListener('deviceorientationabsolute', onOrientation as EventListener);
      host?.removeEventListener('orientationchange', update);
      host?.screen.orientation?.removeEventListener('change', update);
      changed(null);
    },
  };
}
