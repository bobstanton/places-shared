import { MapPlace, hasTrackData } from '../Place';
import type { MapPrepareTimings } from '../settings/MapConfiguration';

export interface DebugTilesetSummary {
  url: string;
  layers: Array<{ id: string; fields: Record<string, string> }>;
}

export interface DebugOverlayInput {
  places: MapPlace[];
  overlayCount?: number;
  geoJsonOverlayCount?: number;
  imageOverlayCount: number;
  vectorTileOverlayCount?: number;
  providerName: string;
  style?: string;
  loadStartTime: number;
  prepareTimings?: MapPrepareTimings;
  tilesets?: DebugTilesetSummary[];
}

export type DebugOverlayDataUpdate = Pick<DebugOverlayInput, 'places' | 'overlayCount' | 'geoJsonOverlayCount' | 'imageOverlayCount' | 'vectorTileOverlayCount'>;

export interface DebugData extends DebugOverlayInput {
  overlayCount: number;
  trackCount: number;
  renderStartTime?: number;
  renderEndTime?: number;
  updateData?: (update: DebugOverlayDataUpdate) => void;
}

export interface DebugOverlayBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface DebugOverlayMapState {
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  center: {
    lat: number;
    lng: number;
  };
  bounds?: DebugOverlayBounds;
}

export interface DebugFeatureSummary {
  layer?: string;
  sourceLayer?: string;
  geometryType?: string;
  properties?: Record<string, unknown> | null;
  coordinatesSummary?: unknown;
  wouldPassPoiFilter?: boolean;
}

export interface DebugOverlayAdapter {
  interactive?: boolean;
  getState(): DebugOverlayMapState;
  onStateChange(handler: () => void): void;
  onMouseMove(handler: (lat: number, lng: number) => void): void;
  onMouseOut(handler: () => void): void;
  onClickFeatures?(handler: (features: DebugFeatureSummary[]) => void): void;
}

interface DebugBoundsLike {
  getSouth(): number;
  getWest(): number;
  getNorth(): number;
  getEast(): number;
}

interface DebugCenterLike {
  lat: number;
  lng: number;
}

interface DebugVectorMapLike {
  getZoom(): number;
  getMinZoom(): number;
  getMaxZoom(): number;
  getCenter(): DebugCenterLike;
  getBounds(): DebugBoundsLike;
  on(type: string, handler: (event: {
    lngLat?: DebugCenterLike;
    point?: { x: number; y: number };
    latlng?: DebugCenterLike;
  }) => void): unknown;
  queryRenderedFeatures?(geometry?: unknown): Array<Parameters<typeof createDebugFeatureSummary>[0]>;
}

interface DebugLeafletMapLike {
  getZoom(): number;
  getMinZoom(): number;
  getMaxZoom(): number;
  getCenter(): DebugCenterLike;
  getBounds(): DebugBoundsLike;
  on(type: string, handler: (event: { latlng?: DebugCenterLike }) => void): unknown;
}

function rafCoalesced(handler: () => void): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      handler();
    });
  };
}

function rafCoalescedLatLng(handler: (lat: number, lng: number) => void): (lat: number, lng: number) => void {
  let pending: { lat: number; lng: number } | null = null;
  return (lat, lng) => {
    const scheduled = pending !== null;
    pending = { lat, lng };
    if (scheduled) return;
    window.requestAnimationFrame(() => {
      const last = pending;
      pending = null;
      if (last) handler(last.lat, last.lng);
    });
  };
}

export function createVectorDebugOverlayAdapter(mapSource: unknown, options: { includeClickFeatures?: boolean } = {}): DebugOverlayAdapter {
  const map = mapSource as DebugVectorMapLike;
  return {
    getState: () => getCommonDebugMapState(map),
    onStateChange: handler => {
      const coalesced = rafCoalesced(handler);
      map.on('zoom', coalesced);
      map.on('zoomend', coalesced);
      map.on('move', coalesced);
      map.on('moveend', coalesced);
    },
    onMouseMove: handler => {
      const coalesced = rafCoalescedLatLng(handler);
      map.on('mousemove', event => {
        if (event.lngLat) coalesced(event.lngLat.lat, event.lngLat.lng);
      });
    },
    onMouseOut: handler => {
      map.on('mouseout', handler);
    },
    onClickFeatures: options.includeClickFeatures && map.queryRenderedFeatures
      ? handler => {
          map.on('click', event => {
            if (!event.point || !map.queryRenderedFeatures) {
              handler([]);
              return;
            }
            const tolerance = 10;
            const bbox = [
              [event.point.x - tolerance, event.point.y - tolerance],
              [event.point.x + tolerance, event.point.y + tolerance]
            ];
            handler(map.queryRenderedFeatures(bbox).map(createDebugFeatureSummary));
          });
        }
      : undefined
  };
}

export function createLeafletDebugOverlayAdapter(mapSource: unknown): DebugOverlayAdapter {
  const map = mapSource as DebugLeafletMapLike;
  return {
    interactive: false,
    getState: () => getCommonDebugMapState(map),
    onStateChange: handler => {
      const coalesced = rafCoalesced(handler);
      map.on('zoom', coalesced);
      map.on('zoomend', coalesced);
      map.on('move', coalesced);
      map.on('moveend', coalesced);
    },
    onMouseMove: handler => {
      const coalesced = rafCoalescedLatLng(handler);
      map.on('mousemove', event => {
        if (event.latlng) coalesced(event.latlng.lat, event.latlng.lng);
      });
    },
    onMouseOut: handler => {
      map.on('mouseout', handler);
    }
  };
}

export function addSharedDebugOverlay(container: HTMLElement, input: DebugOverlayInput, adapter: DebugOverlayAdapter): DebugData {
  const trackCount = input.places.filter(place => hasTrackData(place)).length;
  const debugData: DebugData = {
    ...input,
    overlayCount: input.overlayCount ?? input.geoJsonOverlayCount ?? 0,
    trackCount,
    renderStartTime: Date.now()
  };

  const debugDiv = createDiv({ cls: 'places-debug-overlay' });
  debugDiv.setCssProps({
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(0, 0, 0, 0.85)',
    color: '#00ff00',
    padding: '10px 14px',
    fontFamily: 'monospace',
    fontSize: '12px',
    borderRadius: '4px',
    zIndex: '2147483000',
    pointerEvents: 'auto',
    userSelect: 'text',
    webkitUserSelect: 'text',
    lineHeight: '1.5',
    minWidth: '280px',
    maxWidth: 'min(350px, calc(100% - 20px))',
    maxHeight: 'calc(100% - 20px)',
    overflowX: 'auto',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    webkitOverflowScrolling: 'touch',
    touchAction: 'pan-x pan-y',
    boxSizing: 'border-box'
  });
  debugDiv.addEventListener('wheel', event => event.stopPropagation());
  debugDiv.addEventListener('mousedown', event => event.stopPropagation());
  debugDiv.addEventListener('dblclick', event => event.stopPropagation());
  debugDiv.addEventListener('touchstart', event => event.stopPropagation());
  debugDiv.addEventListener('touchmove', event => event.stopPropagation());
  container.appendChild(debugDiv);

  const createSection = (title: string) => {
    const section = createDiv();
    section.setCssProps({ marginBottom: '6px' });
    const titleSpan = section.createSpan({ text: title });
    titleSpan.setCssProps({
      color: '#ffff00',
      fontWeight: 'bold'
    });
    return section;
  };

  const mapStateSection = createSection('Map State');
  const zoomLine = createDiv();
  const centerLine = createDiv();
  const boundsLine = createDiv();
  mapStateSection.appendChild(zoomLine);
  mapStateSection.appendChild(centerLine);
  mapStateSection.appendChild(boundsLine);
  debugDiv.appendChild(mapStateSection);

  const providerSection = createSection('Provider');
  providerSection.createDiv({ text: `Provider: ${input.providerName}` });
  if (input.style) {
    providerSection.createDiv({ text: `Style: ${input.style}` });
  }
  debugDiv.appendChild(providerSection);

  const dataSection = createSection('Data');
  const markersLine = dataSection.createDiv();
  const tracksLine = dataSection.createDiv();
  const overlaysLine = dataSection.createDiv();
  const imageOverlaysLine = dataSection.createDiv();
  const vectorTileOverlaysLine = input.vectorTileOverlayCount !== undefined ? dataSection.createDiv() : undefined;
  const renderDataSection = () => {
    markersLine.textContent = `Markers: ${debugData.places.length}`;
    tracksLine.textContent = `Tracks: ${debugData.trackCount}`;
    overlaysLine.textContent = debugData.geoJsonOverlayCount !== undefined
      ? `GeoJSON overlays: ${debugData.geoJsonOverlayCount}`
      : `Overlays: ${debugData.overlayCount}`;
    imageOverlaysLine.textContent = `Image overlays: ${debugData.imageOverlayCount}`;
    if (vectorTileOverlaysLine) {
      vectorTileOverlaysLine.textContent = `Vector tile overlays: ${debugData.vectorTileOverlayCount ?? 0}`;
    }
  };
  renderDataSection();
  debugData.updateData = update => {
    debugData.places = update.places;
    debugData.trackCount = update.places.filter(place => hasTrackData(place)).length;
    if (update.overlayCount !== undefined) debugData.overlayCount = update.overlayCount;
    if (update.geoJsonOverlayCount !== undefined) debugData.geoJsonOverlayCount = update.geoJsonOverlayCount;
    debugData.imageOverlayCount = update.imageOverlayCount;
    if (update.vectorTileOverlayCount !== undefined) debugData.vectorTileOverlayCount = update.vectorTileOverlayCount;
    renderDataSection();
  };
  debugDiv.appendChild(dataSection);

  if (input.tilesets?.length) {
    const tilesetSection = createSection('Tilesets');
    for (const tileset of input.tilesets) {
      tilesetSection.createDiv({ text: tileset.url.split('/').pop() ?? tileset.url });
      for (const layer of tileset.layers) {
        const fields = Object.keys(layer.fields);
        const line = tilesetSection.createDiv({
          text: `  ${layer.id}${fields.length ? `: ${fields.join(', ')}` : ''}`,
        });
        line.setCssProps({ color: '#c0c0c0', whiteSpace: 'normal' });
      }
    }
    debugDiv.appendChild(tilesetSection);
  }

  const mouseSection = createSection('Mouse');
  const mouseLine = createDiv({ text: 'Move mouse over map...' });
  mouseSection.appendChild(mouseLine);
  debugDiv.appendChild(mouseSection);

  if (adapter.onClickFeatures) {
    const clickSection = createSection('Click Features');
    const clickInfo = createDiv({ text: 'Click on map to see features...' });
    clickInfo.setCssProps({
      maxHeight: '400px',
      overflowY: 'auto',
      fontSize: '10px'
    });
    clickSection.appendChild(clickInfo);
    debugDiv.appendChild(clickSection);

    adapter.onClickFeatures(features => renderClickFeatures(clickInfo, features));
  }

  const perfSection = createSection('Performance');
  const perfLines = createDiv();
  perfSection.appendChild(perfLines);
  debugDiv.appendChild(perfSection);

  const updateMapState = () => {
    const state = adapter.getState();
    const minZoom = state.minZoom ?? 'N/A';
    const maxZoom = state.maxZoom ?? 'N/A';

    zoomLine.textContent = `Zoom: ${state.zoom.toFixed(2)} (min: ${minZoom}, max: ${maxZoom})`;
    centerLine.textContent = `Center: ${state.center.lat.toFixed(6)}, ${state.center.lng.toFixed(6)}`;
    boundsLine.empty();
    boundsLine.appendText('Bounds: ');
    const boundsSpan = boundsLine.createSpan({
      text: state.bounds
        ? `SW(${state.bounds.south.toFixed(4)}, ${state.bounds.west.toFixed(4)}) NE(${state.bounds.north.toFixed(4)}, ${state.bounds.east.toFixed(4)})`
        : 'N/A'
    });
    boundsSpan.setCssProps({ fontSize: '10px' });
  };

  const addPerfLine = (label: string, value: string, style?: 'detail' | 'total') => {
    const line = perfLines.createDiv({ text: `${label}: ${value}` });
    if (style === 'detail') line.setCssProps({ paddingLeft: '10px', fontSize: '10px', color: '#8c8' });
    if (style === 'total') line.setCssProps({ color: '#0ff' });
  };

  const updatePerformance = () => {
    const renderStartTime = debugData.renderStartTime ?? Date.now();
    const prepare = debugData.prepareTimings;
    perfLines.empty();

    if (prepare) {
      addPerfLine('Data load', `${Math.round(prepare.collectMs)}ms`);
      for (const source of prepare.sources) {
        addPerfLine(source.id, `${Math.round(source.durationMs)}ms, ${source.places} places`, 'detail');
      }
      addPerfLine('Fingerprint', `${Math.round(prepare.fingerprintMs)}ms`);
      addPerfLine('Styles', `${Math.round(prepare.stylesMs)}ms`);
      addPerfLine('Labels', `${Math.round(prepare.labelsMs)}ms`);
      addPerfLine('Prepare total', `${Math.round(prepare.totalMs)}ms`);
    }

    addPerfLine('Map render', `${renderStartTime - debugData.loadStartTime}ms`);

    if (prepare) {
      addPerfLine('Block total', `${renderStartTime - prepare.startTime}ms`, 'total');
    }
  };

  adapter.onStateChange(updateMapState);
  adapter.onMouseMove((lat, lng) => {
    mouseLine.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
  });
  adapter.onMouseOut(() => {
    mouseLine.textContent = 'Move mouse over map...';
  });

  updateMapState();
  window.setTimeout(() => {
    debugData.renderEndTime = Date.now();
    updatePerformance();
  }, 100);

  return debugData;
}

export function createDebugFeatureSummary(feature: {
  layer?: { id?: string };
  sourceLayer?: string;
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}): DebugFeatureSummary {
  const properties = feature.properties ?? null;
  const geometryType = feature.geometry?.type ?? 'unknown';
  const hasName = !!properties?.name;
  const isLine = geometryType === 'LineString' || geometryType === 'MultiLineString';
  const hasClassInfo = !!(properties?.class || properties?.ref || properties?.subclass);

  return {
    layer: feature.layer?.id,
    sourceLayer: feature.sourceLayer,
    geometryType,
    properties,
    coordinatesSummary: geometryType === 'Point'
      ? feature.geometry?.coordinates
      : `[${getCoordinateCount(feature.geometry?.coordinates)} coords]`,
    wouldPassPoiFilter: hasName || (isLine && hasClassInfo)
  };
}

function renderClickFeatures(clickInfo: HTMLElement, features: DebugFeatureSummary[]): void {
  clickInfo.empty();

  if (features.length === 0) {
    const noFeatures = clickInfo.createSpan({ text: 'No features at click point' });
    noFeatures.setCssProps({ color: '#888' });
    return;
  }

  const headerDiv = clickInfo.createDiv({ text: `Found ${features.length} features:` });
  headerDiv.setCssProps({ color: '#0ff' });

  features.forEach((feature, index) => {
    const geomType = feature.geometryType ?? 'unknown';
    const layerId = feature.layer ?? 'unknown';

    const featureDiv = clickInfo.createDiv();
    featureDiv.setCssProps({
      marginTop: '4px',
      borderTop: '1px solid #333',
      paddingTop: '2px'
    });

    const featureHeader = featureDiv.createDiv();
    featureHeader.setCssProps({
      color: feature.wouldPassPoiFilter ? '#0f0' : '#f88',
      cursor: 'pointer'
    });

    const jsonPre = featureDiv.createEl('pre');
    jsonPre.setCssProps({
      display: 'none',
      margin: '4px 0',
      padding: '4px',
      background: '#1a1a1a',
      borderRadius: '3px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      fontSize: '9px',
      maxHeight: '300px',
      overflowY: 'auto'
    });
    jsonPre.textContent = JSON.stringify({
      layer: feature.layer,
      sourceLayer: feature.sourceLayer,
      properties: feature.properties,
      geometry: {
        type: feature.geometryType,
        coordinates: feature.coordinatesSummary
      }
    }, null, 2);

    let expanded = false;
    const updateHeader = () => {
      featureHeader.textContent = `${expanded ? 'v' : '>'} ${index + 1}. ${geomType} - ${layerId}`;
    };
    featureHeader.addEventListener('click', () => {
      expanded = !expanded;
      jsonPre.setCssProps({
        display: expanded ? 'block' : 'none'
      });
      updateHeader();
    });
    updateHeader();
  });
}

function getCoordinateCount(coordinates: unknown): number {
  return Array.isArray(coordinates) ? coordinates.length : 0;
}

function getCommonDebugMapState(map: {
  getZoom(): number;
  getMinZoom(): number;
  getMaxZoom(): number;
  getCenter(): DebugCenterLike;
  getBounds(): DebugBoundsLike;
}): DebugOverlayMapState {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    zoom: map.getZoom(),
    minZoom: map.getMinZoom(),
    maxZoom: map.getMaxZoom(),
    center: { lat: center.lat, lng: center.lng },
    bounds: {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast()
    }
  };
}
