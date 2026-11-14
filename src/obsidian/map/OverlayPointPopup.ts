import type * as GeoJSON from 'geojson';
import type { App } from 'obsidian';
import { isGeoJSONOverlay, type GeoJSONOverlay, type Overlay } from '../../overlay/index';
import type { MapRenderRequest, PopupContentConfig } from '../../settings/index';
import { buildOverlayPointPopupContent, createSourceLinkClickHandler } from '../../map/index';
import { renderFeaturePopupContentAsync } from './PopupContentRenderer';
import { openLocalFile } from '../utils/LocalFile';

export function resolveOverlayPointSource(properties: Record<string, unknown>, overlays: readonly Overlay[], fallbackSourcePath?: string): { sourcePath?: string; overlay?: GeoJSONOverlay } {
  const sourcePath = typeof properties._overlaySource === 'string' ? properties._overlaySource : fallbackSourcePath;
  const overlay = overlays.filter(isGeoJSONOverlay).find(candidate => candidate.source === sourcePath);

  return { sourcePath, overlay };
}

export interface OverlayPointPopupOptions {
  app: App;
  feature: GeoJSON.Feature;
  sourcePath?: string;
  popupConfig?: PopupContentConfig;
  markdownSourcePath?: string;
  popupRenderers?: MapRenderRequest['runtime']['popupRenderers'];
  onRendered?: () => void;
}

export function buildOverlayPointPopup(options: OverlayPointPopupOptions): HTMLElement {
  const properties: Record<string, unknown> = options.feature.properties || {};
  const content = buildOverlayPointPopupContent({
    properties,
    sourcePath: options.sourcePath,
    defaultName: 'Point',
    includeProperties: !options.popupConfig,
    onSourceLinkClick: createSourceLinkClickHandler(options.sourcePath, (linkPath) => openLocalFile(options.app, linkPath)),
  });

  if (options.popupConfig) {
    renderFeaturePopupContentAsync(options.app, {
      kind: 'feature',
      feature: options.feature,
      sourcePath: options.sourcePath,
      presentation: 'point',
      markdownSourcePath: options.markdownSourcePath,
    }, options.popupConfig, content, {
      markdownSourcePath: options.markdownSourcePath,
      popupRenderers: options.popupRenderers,
      onRendered: options.onRendered,
    });
  }

  return content;
}
