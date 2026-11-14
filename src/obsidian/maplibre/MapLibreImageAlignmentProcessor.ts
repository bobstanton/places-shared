import { App, MarkdownPostProcessorContext } from "obsidian";
import type { GeoJSON } from "geojson";
import { getGl } from "../../maplibre/GlRuntime";
import { ImageOverlayAlignmentRunner, ImageOverlayAlignmentSettings, createMapGlImageAlignmentMap, type MapGlAlignmentMapLike, type MapGlMarkerConstructor } from "./ImageOverlayAlignment";
import type { ImageAlignmentProcessor, ImageAlignmentServices } from "../services/index";
import { isGeoJSONOverlay } from "../../overlay/index";
import { MapLibreOverlayHandler } from './MapLibreOverlays';
import { MapState } from '../../maplibre/MapState';

export function buildImageAlignment(app: App, _providerName: string, getStyleUrl: (style?: string) => string): ImageAlignmentProcessor {
  const processor = new MapLibreImageAlignmentProcessor(app, getStyleUrl);

  return processor.process.bind(processor);
}

export class MapLibreImageAlignmentProcessor {
  constructor(private app: App, private getStyleUrl: (style?: string) => string) {}

  process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, services?: ImageAlignmentServices): void {
    const runner = new ImageOverlayAlignmentRunner(this.app, {
      showZoomButtons: true,
      formatDistance: services?.formatDistance,
      createMap: (container: HTMLElement, settings: ImageOverlayAlignmentSettings) => {
        const map = new (getGl().Map)({
          container,
          style: this.getStyleUrl(settings.style),
          center: settings.initialCenter ?? [0, 0],
          zoom: settings.initialZoom ?? 2,
          keyboard: false,
          doubleClickZoom: false,
          boxZoom: false,
          pitchWithRotate: false,
          dragRotate: false,
          touchPitch: false
        });
        const alignmentMap = createMapGlImageAlignmentMap(
          map as unknown as MapGlAlignmentMapLike,
          getGl().Marker as unknown as MapGlMarkerConstructor,
          getGl().LngLatBounds
        );
        let disposed = false;
        let pointMatching = false;
        const referenceLines: [number, number][][] = [];

        return {
          ...alignmentMap,
          getReferenceLines: () => referenceLines,
          setPointMatching: (matching: boolean) => { pointMatching = matching; },
          remove: () => {
            disposed = true;
            MapState.cleanup(map);
            alignmentMap.remove();
          },
          addReferenceOverlays: async (definitions, sourcePath) => {
            if (!services) throw new Error('Reload Places and the map provider to load reference tracks.');
            const result = await services.loadOverlays(definitions);

            if (disposed) return [];
            const references = result.overlays.filter(isGeoJSONOverlay);

            referenceLines.splice(0);
            for (const reference of references) collectAlignmentReferenceLines(reference.geojson, referenceLines);
            const errors = [...result.errors];

            for (const overlay of result.overlays) {
              if (!isGeoJSONOverlay(overlay)) errors.push({
                path: overlay.source ?? 'overlays',
                error: 'Reference overlays must be tracks or geodata.',
              });
            }

            await new MapLibreOverlayHandler(this.app, { isInteractionEnabled: () => !pointMatching }).processOverlays(map, references, true, undefined, sourcePath);
            if (!disposed) map.moveLayer('overlay-layer');

            return errors;
          },
        };
      }
    });

    runner.process(source, el, ctx);
  }
}

export function collectAlignmentReferenceLines(value: GeoJSON, lines: [number, number][][]): void {
  if (value.type === 'FeatureCollection') {
    for (const feature of value.features) collectAlignmentReferenceLines(feature, lines);
  } else if (value.type === 'Feature') {
    if (value.geometry) collectAlignmentReferenceLines(value.geometry, lines);
  } else if (value.type === 'GeometryCollection') {
    for (const geometry of value.geometries) collectAlignmentReferenceLines(geometry, lines);
  } else if (value.type === 'LineString' || value.type === 'MultiLineString') {
    const coordinates = value.type === 'LineString' ? [value.coordinates] : value.coordinates;

    for (const line of coordinates) {
      let segment: [number, number][] = [];

      for (const point of line) {
        if (Number.isFinite(point[0]) && Number.isFinite(point[1])) segment.push([point[0], point[1]]);
        else { if (segment.length > 1) lines.push(segment); segment = []; }
      }

      if (segment.length > 1) lines.push(segment);
    }
  }
}
