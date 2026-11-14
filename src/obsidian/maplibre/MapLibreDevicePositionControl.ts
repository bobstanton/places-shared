import type * as maplibregl from 'maplibre-gl';
import { attachDevicePositionControl, createDevicePositionMarkerElement, updateDevicePositionMarkerHeading, type DevicePositionControlHandle } from "../map/index";
import { getGl } from '../../maplibre/GlRuntime';

type MoveStartEvent = { originalEvent?: { type?: string } };

export function attachMapLibreDevicePositionControl(map: maplibregl.Map, button: HTMLButtonElement): DevicePositionControlHandle {
  const document = map.getContainer().ownerDocument;
  let marker: maplibregl.Marker | null = null;
  let disposed = false;
  let heading: number | null = null;
  const updateHeading = () => {
    if (marker) updateDevicePositionMarkerHeading(marker.getElement(), heading, map.getBearing());
  };

  map.on('rotate', updateHeading);

  const control = attachDevicePositionControl({
    button,
    geolocation: document.defaultView?.navigator.geolocation,
    adapter: {
      currentZoom: () => map.getZoom(),
      positionChanged: coordinate => {
        const lngLat: [number, number] = [coordinate.longitude, coordinate.latitude];

        if (!marker) {
          marker = new (getGl().Marker)({
            element: createDevicePositionMarkerElement(),
            anchor: 'center',
          }).setLngLat(lngLat).addTo(map);
        } else {
          marker.setLngLat(lngLat);
        }

        updateHeading();
      },
      headingChanged: value => {
        heading = value;
        updateHeading();
      },
      positionRemoved: () => {
        marker?.remove();
        marker = null;
      },
      recenter: (coordinate, zoom) => {
        const options: maplibregl.JumpToOptions = {
          center: [coordinate.longitude, coordinate.latitude],
        };

        if (zoom !== undefined) options.zoom = zoom;
        map.jumpTo(options);
      },
      onUserMoveStart: handler => {
        const listener = (event: MoveStartEvent) => {
          if (event.originalEvent && event.originalEvent.type !== 'resize') handler();
        };

        map.on('movestart', listener);

        return () => map.off('movestart', listener);
      },
    },
  });

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      control.dispose();
      map.off('rotate', updateHeading);
      marker?.remove();
      marker = null;
    },
  };
}
