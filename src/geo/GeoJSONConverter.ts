import type { Feature, FeatureCollection, Geometry } from "geojson";
import { MapPlace, getLabelOffsetEm } from "../Place";
import { PlacesBoundingBox } from "./PlacesBoundingBox";
import { conditionalProps } from "../settings/ParseHelpers";
import { getPlaceId } from "../track/TrackVisibilityResolver";
import { mergeZoomRanges } from "../ZoomVisibility";

export interface GeoJSONConversionResult {
  featureCollection: FeatureCollection<Geometry, Record<string, unknown>>;
  boundingBox: PlacesBoundingBox;
}

export interface ConvertPlacesOptions {
  includeMapPlace?: boolean;
}

export function convertPlacesToFeatureCollection(places: MapPlace[], options?: ConvertPlacesOptions): GeoJSONConversionResult {
  const boundingBox = new PlacesBoundingBox();

  const featureCollection: FeatureCollection<Geometry, Record<string, unknown>> = {
    type: "FeatureCollection",
    features: Array<Feature<Geometry, Record<string, unknown>>>()
  };

  places.forEach((place, index) => {
    boundingBox.update(place.latitude, place.longitude);

    if (place.overlay?.geojson) {
      for (const feature of place.overlay.geojson.features) {
        if (feature.geometry.type === 'LineString') {
          for (const coord of feature.geometry.coordinates) {
            boundingBox.update(coord[1], coord[0]);
          }
        } else if (feature.geometry.type === 'Point') {
          const coords = feature.geometry.coordinates as [number, number];

          boundingBox.update(coords[1], coords[0]);
        }
      }
    }

    const properties: Record<string, unknown> = {
      "description": place.name,
      "file_path": place.filePath || "",
      "icon": place.icon,
      "placeId": getPlaceId(place)
    };

    if (options?.includeMapPlace !== false) {
      properties.mapPlace = place;
    }

    const labelZIndex = place.labelStyle?.zIndex ?? place.iconStyle?.zIndex ?? 0;

    properties.labelSortKey = -labelZIndex - index / (places.length + 1);

    const labelStyle = place.labelStyle;

    if (labelStyle) {
      Object.assign(properties, conditionalProps({
        labelColor: labelStyle.color,
        labelFontSize: labelStyle.fontSize,
        labelOpacity: labelStyle.opacity,
        labelHaloColor: labelStyle.haloColor,
        labelHaloWidth: labelStyle.haloWidth,
        labelHaloBlur: labelStyle.haloBlur,
        labelHasUserStyle: labelStyle.hasUserStyle ? true : undefined,
      }));
    }

    // Hide the label with its marker.
    const labelZoom = mergeZoomRanges(place.iconStyle?.zoom, labelStyle?.zoom);

    Object.assign(properties, conditionalProps({
      labelMinZoom: labelZoom?.minZoom,
      labelMaxZoom: labelZoom?.maxZoom,
    }));
    const labelOffsetEm = getLabelOffsetEm(place.iconStyle, labelStyle);

    if (labelOffsetEm !== 1) {
      properties.labelOffsetEm = labelOffsetEm;
    }

    featureCollection.features.push({
      "type": "Feature",
      "properties": properties,
      "geometry": {
        "type": "Point",
        "coordinates": [place.longitude, place.latitude]
      }
    });
  });

  return { featureCollection, boundingBox };
}

export function convertPlacesToGeoJSONData(places: MapPlace[], options?: ConvertPlacesOptions): [Record<string, unknown>, PlacesBoundingBox] {
  const { featureCollection, boundingBox } = convertPlacesToFeatureCollection(places, options);

  const geoJsonData = {
    type: "geojson",
    data: featureCollection
  };

  return [geoJsonData, boundingBox];
}

export function convertPointsToFeatureCollection(points: Array<[number, number]>): FeatureCollection {
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: Array<Feature>()
  };

  featureCollection.features.push({
    "type": "Feature",
    "id": "path",
    "properties": {},
    "geometry": {
      "type": "MultiLineString",
      "coordinates": [points]
    }
  });

  return featureCollection;
}
