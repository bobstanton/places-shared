import { MapStateManager } from './index';
import { updateZoomContainerState } from './index';
import type { MapSourceContext } from '../settings/index';
import type { MapCameraGuard } from './MapCameraGuard';
import { ensureMapSurfaceLifecycle } from './MapSurfaceLifecycle';

export interface MapSurfaceEngine {
  on(event: 'movestart' | 'zoomstart' | 'rotatestart' | 'moveend' | 'zoom' | 'zoomend', handler: () => void): void;
  getCenter(): { lat: number; lng: number };
  getZoom(): number;
  resize(): void;
}

export interface MapSurfacePlumbingOptions {
  container: HTMLElement;
  engine: MapSurfaceEngine;
  source: MapSourceContext;
  guard: MapCameraGuard;
  measure?: <T>(event: string, work: () => T, details?: Record<string, unknown>, options?: { slowOnly?: boolean }) => T;
}

export function withGuardedCamera(guard: MapCameraGuard, move: () => void): void {
  const release = guard.beginProgrammaticMove();

  try {
    move();
  } finally {
    release();
  }
}

export function persistMapViewport(engine: Pick<MapSurfaceEngine, 'getCenter' | 'getZoom'>, source: MapSourceContext): void {
  const stateKey = MapStateManager.getStateKey(source);

  if (!stateKey) return;
  const center = engine.getCenter();

  MapStateManager.saveState(stateKey, { zoom: engine.getZoom(), center: { lat: center.lat, lng: center.lng } });
}

export function attachMapSurfacePlumbing(options: MapSurfacePlumbingOptions): () => void {
  const { container, engine, guard } = options;
  const measure = options.measure ?? (<T>(_event: string, work: () => T) => work());
  const lifecycle = ensureMapSurfaceLifecycle(container);

  const updateZoom = () => updateZoomContainerState(container, engine.getZoom());

  engine.on('zoom', () => measure('zoom-state-update', updateZoom, { zoom: engine.getZoom() }, { slowOnly: true }));
  engine.on('zoomend', () => measure('zoomend-state-update', updateZoom, { zoom: engine.getZoom() }));
  measure('initial-zoom-state', updateZoom, { zoom: engine.getZoom() });

  engine.on('moveend', () => {
    if (guard.isProgrammaticMove()) return;
    persistMapViewport(engine, options.source);
  });

  const markGesture = () => {
    if (guard.isProgrammaticMove()) return;
    lifecycle.reportUserCameraGesture();
  };

  engine.on('movestart', markGesture);
  engine.on('zoomstart', markGesture);
  engine.on('rotatestart', markGesture);

  const resizeObserver = new ResizeObserver(entries => {
    withGuardedCamera(guard, () => engine.resize());
    const rect = entries[entries.length - 1]?.contentRect;

    if (rect) lifecycle.reportSize(rect.width, rect.height);
  });

  resizeObserver.observe(container);

  return () => resizeObserver.disconnect();
}
