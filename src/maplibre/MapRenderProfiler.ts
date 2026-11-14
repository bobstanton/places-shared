import type { PerformanceMonitor } from "../utils/index";

interface ProfileMap {
  on(event: 'render' | 'idle' | 'remove', listener: () => void): unknown;
  off(event: 'render' | 'idle' | 'remove', listener: () => void): unknown;
}

interface TrackProfileMap extends ProfileMap {
  getSource(id: string): unknown;
  getLayer(id: string): unknown;
  isSourceLoaded(id: string): boolean;
  isMoving(): boolean;
  queryRenderedFeatures(options: { layers: string[] }): Array<{ source: string }>;
}

export interface SubmittedTrackSource {
  sourceId: string;
  layerIds: string[];
}

type Phase = 'initial' | 'update';

export class MapRenderProfiler {
  private pending = new WeakMap<ProfileMap, Map<Phase, () => void>>();
  private pendingTracks = new WeakMap<ProfileMap, () => void>();

  cancelTracks(map: ProfileMap): void {
    this.pendingTracks.get(map)?.();
  }

  startTracks(map: TrackProfileMap, perf: PerformanceMonitor, sources: SubmittedTrackSource[], started: number): void {
    this.cancelTracks(map);
    if (!sources.length) return;
    let lastProbeAt = -Infinity;
    let rendered = false;
    let queries = 0;
    let totalQueryMs = 0;
    let movingFramesSkipped = 0;
    let throttledFramesSkipped = 0;
    const payload = () => ({ sourceIds: sources.map(source => source.sourceId), profileElapsedMs: performance.now() - started,
      observation: 'sampled', sampleIntervalMs: 100, queries, totalQueryMs, movingFramesSkipped, throttledFramesSkipped });
    const cleanup = () => {
      map.off('render', onRender);
      map.off('idle', onIdle);
      map.off('remove', cleanup);
      this.pendingTracks.delete(map);
    };
    const probe = (trigger: 'render' | 'idle'): boolean => {
      const frameAt = performance.now();

      if (map.isMoving()) { movingFramesSkipped++;

 return false; }

      if (trigger === 'render' && frameAt - lastProbeAt < 100) { throttledFramesSkipped++;

 return false; }

      const layers = sources.filter(source => map.getSource(source.sourceId) && map.isSourceLoaded(source.sourceId))
        .flatMap(source => source.layerIds.filter(id => map.getLayer(id)));

      if (!layers.length) return false;
      lastProbeAt = frameAt;
      const queryStarted = performance.now();
      const features = map.queryRenderedFeatures({ layers });
      const queryMs = performance.now() - queryStarted;

      queries++;
      totalQueryMs += queryMs;
      if (!features.length) return false;
      perf.mark('viewport-observed-track-frame', { ...payload(), profileElapsedMs: frameAt - started, queryMs, trigger, renderedSourceIds: [...new Set(features.map(feature => feature.source))] });
      cleanup();

      return true;
    };
    const onRender = () => {
      rendered = true;
      probe('render');
    };
    const onIdle = () => {
      if (rendered && probe('idle')) return;
      perf.mark('viewport-no-track-frame', { ...payload(), reason: 'idle-without-rendered-track' });
      cleanup();
    };

    this.pendingTracks.set(map, () => {
      perf.mark('viewport-track-profile-superseded', payload());
      cleanup();
    });
    map.on('render', onRender);
    map.on('idle', onIdle);
    map.on('remove', cleanup);
  }

  start(map: ProfileMap, perf: PerformanceMonitor, phase: Phase, details: () => Record<string, unknown>, log: (message: string, details: Record<string, unknown>) => void): void {
    let phases = this.pending.get(map);

    if (!phases) this.pending.set(map, phases = new Map<Phase, () => void>());
    phases.get(phase)?.();
    const started = performance.now();
    let rendered = false;
    const payload = () => ({ phase, profileElapsedMs: Math.round(performance.now() - started), ...details() });
    const cleanup = () => {
      map.off('render', onRender);
      map.off('idle', onIdle);
      map.off('remove', cleanup);
      phases.delete(phase);
    };
    const onRender = () => {
      rendered = true;
      map.off('render', onRender);
      const data = payload();

      perf.mark('map-render', data);
      log('GL map frame rendered', { ...data, elapsedMs: data.profileElapsedMs });
    };
    const onIdle = () => {
      const data = payload();

      perf.mark('map-idle', data);
      log('GL map reached idle', { ...data, elapsedMs: data.profileElapsedMs });
      cleanup();
    };

    phases.set(phase, () => {
      perf.mark('map-profile-superseded', { ...payload(), rendered });
      cleanup();
    });
    map.on('render', onRender);
    map.on('idle', onIdle);
    map.on('remove', cleanup);
  }
}
