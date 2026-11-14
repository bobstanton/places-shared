import type * as GeoJSON from 'geojson';
import type * as maplibregl from 'maplibre-gl';
import { logger } from "../../utils/index";
import { buildPoiDiscoveryPopupContent } from "../map/index";
import { shouldFilterPOI, type PlaceNoteHost } from "../../map/index";
import { MapLibreHelper } from './MapLibreHelper';

export interface POIDiscoveryInfo {
  name: string;
  class: string;
  subclass: string;
  coordinates: maplibregl.LngLat;
  layer: string;
  sourceLayer: string;
  geometry?: GeoJSON.Geometry;
}

export class POIDiscoveryHandler {
  setup(map: maplibregl.Map, poiFilterPatterns: string[], placeNoteHost?: PlaceNoteHost, getSourcePath?: () => string | undefined): void {
    map.on('click', (e) => {
      if (map.getContainer().closest('.places-track-builder-active')) return;
      queueMicrotask(() => this.discoverAt(map, e, poiFilterPatterns, placeNoteHost, getSourcePath?.()));
    });
  }

  private discoverAt(map: maplibregl.Map, e: maplibregl.MapMouseEvent, poiFilterPatterns: string[], placeNoteHost?: PlaceNoteHost, sourcePath?: string): void {
    {
      if (e.defaultPrevented) {
        return;
      }

      const tolerance = 10;
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance]
      ];
      const features = map.queryRenderedFeatures(bbox);

      const poiFeatures = features.filter(f => {
        const layerId = f.layer?.id || '';

        if (layerId.startsWith('places-') || layerId.startsWith('track-') || layerId.startsWith('geojson-') || layerId.startsWith('heatmap')) {
          return false;
        }

        if (!f.sourceLayer) {
          return false;
        }

        return f.properties?.name;
      });

      if (poiFeatures.length === 0) return;

      const feature = poiFeatures[0];
      const props: Record<string, unknown> = feature.properties || {};

      if (props.class === undefined && props.type === undefined) {
        logger.scope('POIDiscovery').debug('POI feature has no class/type field', {
          sourceLayer: feature.sourceLayer,
          propertyKeys: Object.keys(props),
        });
      }

      const poiString = (value: unknown): string =>
        typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
      const poiInfo: POIDiscoveryInfo = {
        name: poiString(props.name),
        class: poiString(props.class) || poiString(props.type),
        subclass: poiString(props.subclass),
        coordinates: e.lngLat,
        layer: feature.layer?.id || '',
        sourceLayer: feature.sourceLayer || ''
      };

      if (poiFilterPatterns && poiFilterPatterns.length > 0) {
        if (shouldFilterPOI(poiFilterPatterns, {
          class: poiInfo.class,
          subclass: poiInfo.subclass,
          name: poiInfo.name,
        })) {
          return;
        }
      }

      this.showPopup(map, poiInfo, placeNoteHost, sourcePath);
    }
  }

  private showPopup(map: maplibregl.Map, poi: POIDiscoveryInfo, placeNoteHost?: PlaceNoteHost, sourcePath?: string): void {
    const content = buildPoiDiscoveryPopupContent({
      map,
      poi,
      placeNoteHost,
      sourcePath,
      closePopups: () => MapLibreHelper.closeAllPopups(),
    });

    MapLibreHelper.openPopup(map, poi.coordinates, content);
  }
}
