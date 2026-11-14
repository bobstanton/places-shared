import type { OverlayRenderStyle, VectorTileFilter, VectorTileLayerType, VectorTileOverlay } from './OverlaySystem';
import type { ZoomRange } from '../ZoomVisibility';
import type { PopupContentConfig } from '../settings/PopupConfiguration';

export interface VectorTileOverlayPresetLayer {
  readonly sourceLayer: string;
  readonly layerType: VectorTileLayerType;
  readonly zoom?: ZoomRange;
  readonly filter?: VectorTileFilter;
  readonly style?: OverlayRenderStyle;
  readonly hoverStyle?: OverlayRenderStyle;
  readonly popup?: PopupContentConfig;
  readonly hitLabel?: string;
}

export interface VectorTileOverlayPreset {
  readonly id: string;
  readonly description: string;
  readonly provider: string;
  readonly attribution: string;
  readonly tileZoom?: ZoomRange;
  readonly layers: readonly VectorTileOverlayPresetLayer[];
  tiles(): readonly string[];
}

export interface VectorTileOverlayPresetOverrides {
  readonly source: string;
  readonly sourceLayers?: readonly string[];
  readonly zoom?: ZoomRange;
  readonly filter?: VectorTileFilter;
  readonly style?: OverlayRenderStyle;
  readonly hoverStyle?: OverlayRenderStyle;
  readonly popup?: PopupContentConfig;
}

export function expandVectorTileOverlayPreset(preset: VectorTileOverlayPreset, overrides: VectorTileOverlayPresetOverrides): VectorTileOverlay[] {
  const layers = overrides.sourceLayers
    ? overrides.sourceLayers.map(name => {
      const layer = preset.layers.find(candidate => candidate.sourceLayer === name);

      if (!layer) throw new Error(`Overlay preset "${preset.id}" has no source layer "${name}". Its layers are ${preset.layers.map(candidate => candidate.sourceLayer).join(', ')}.`);

      return layer;
    })
    : preset.layers;
  const tiles = [...preset.tiles()];

  return layers.map(layer => {
    const zoom = layer.zoom || overrides.zoom ? { ...layer.zoom, ...overrides.zoom } : undefined;
    const filter = overrides.filter ?? layer.filter;
    const style = layer.style || overrides.style ? { ...layer.style, ...overrides.style } : undefined;
    const hoverStyle = layer.hoverStyle || overrides.hoverStyle ? { ...layer.hoverStyle, ...overrides.hoverStyle } : undefined;
    const popup = overrides.popup ?? layer.popup;

    return {
      type: 'vector-tile',
      source: overrides.source,
      tiles,
      sourceLayer: layer.sourceLayer,
      layerType: layer.layerType,
      attribution: preset.attribution,
      tileProvider: preset.provider,
      ...(preset.tileZoom ? { tileZoom: preset.tileZoom } : {}),
      ...(zoom ? { zoom } : {}),
      ...(filter ? { filter } : {}),
      ...(style ? { style } : {}),
      ...(hoverStyle ? { hoverStyle } : {}),
      ...(popup ? { popup } : {}),
      ...(layer.hitLabel ? { hitLabel: layer.hitLabel } : {}),
    };
  });
}
