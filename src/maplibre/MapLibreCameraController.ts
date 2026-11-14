import type * as maplibregl from 'maplibre-gl';
import { PlacesBoundingBox } from "../geo/index";
import { extendBoundingBoxWithOverlays } from "../overlay/index";
import type { MapRenderRequest } from "../settings/index";
import type { MapCameraApplyResult } from "../services/index";
import { resolveFitDataCamera, type MapCameraIntent } from "../render/index";
import { isNonInteractivePlace, withGuardedCamera } from "../map/index";
import { MapState } from './MapState';

export function withProgrammaticCamera(map: maplibregl.Map, move: () => void): void {
  withGuardedCamera(MapState.for(map).getCameraGuard(), move);
}

export function applyCameraIntent(map: maplibregl.Map, camera: MapCameraIntent, request: MapRenderRequest): MapCameraApplyResult {
  switch (camera.kind) {
    case 'fit-data': {
      const bounds = new PlacesBoundingBox();

      for (const place of MapState.for(map).getCurrentPlaces()) {
        if (!isNonInteractivePlace(place)) bounds.update(place.latitude, place.longitude);
      }

      extendBoundingBoxWithOverlays(bounds, request.runtime.overlays);
      if (!bounds.isValid()) return { applied: false, reason: 'no valid data bounds' };
      withProgrammaticCamera(map, () => map.fitBounds(bounds.getLngLatBounds(), {
        padding: resolveFitDataCamera(camera).padding,
        animate: false,
        maxZoom: resolveFitDataCamera(camera).maxZoom,
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      }));

      return { applied: true };
    }
    case 'explicit': {
      const currentCenter = map.getCenter();

      withProgrammaticCamera(map, () => map.jumpTo({
        center: camera.center ?? [currentCenter.lng, currentCenter.lat],
        zoom: camera.zoom ?? map.getZoom(),
      }));

      return { applied: true };
    }
    case 'preserve': {
      return { applied: true };
    }
  }
}
