import { isStyleHidden } from "../place/index";
import type * as maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import { getLabelOffsetEm, getMaxIconScale } from "../place/index";
import { getPlaceId } from "../track/index";
import { hasPlaceMarker, getMarkerOffsetLayout, iconZoomScaleProperties, mergeZoomRanges, markerStackingOrder } from "../map/index";
import { conditionalProps } from "../settings/index";
import type { MapPlace } from "../overlay/index";

export function createPointFeature(options: {
  place: MapPlace;
  zoomSizeStops?: number[];
  iconImageId: string;
  glyphImageId?: string;
  mapAlignedIcons?: boolean;
}): GeoJSON.Feature {
  const { place, zoomSizeStops = [], iconImageId, glyphImageId } = options;
  const properties: Record<string, unknown> = {
    description: place.name || '',
    file_path: place.filePath || '',
    icon: place.icon || '',
    placeId: getPlaceId(place),
    iconImage: iconImageId,
    glyphImage: glyphImageId ?? iconImageId,
  };

  if (place.iconStyle?.opacity !== undefined && place.iconStyle.opacity !== 0) properties.iconOpacity = place.iconStyle.opacity;
  const stacking = markerStackingOrder(place);

  if (stacking !== 0) properties.iconSortKey = stacking;
  if (place.iconStyle?.opacity === 0 || place.iconStyle?.inlineCss?.toLowerCase().includes('display: none')) properties.iconHidden = true;
  const labelStyle = place.labelStyle;

  if (isStyleHidden(labelStyle)) properties.labelHidden = true;
  if (place.iconRotation !== undefined) properties.iconRotate = place.iconRotation;
  const renderedScale = (place.iconStyle?.scale ?? 1) / getMaxIconScale(place.iconStyle);

  if (renderedScale !== 1) properties.iconScale = renderedScale;

  const iconZoom = place.iconStyle?.zoom;

  if (iconZoom?.minZoom !== undefined) properties.iconMinZoom = iconZoom.minZoom;
  if (iconZoom?.maxZoom !== undefined) properties.iconMaxZoom = iconZoom.maxZoom;
  Object.assign(properties, iconZoomScaleProperties(place.iconStyle, zoomSizeStops));

  const labelZoom = mergeZoomRanges(iconZoom, labelStyle?.zoom);

  if (labelStyle) {
    Object.assign(properties, conditionalProps({
      labelColor: labelStyle.color,
      labelFontSize: labelStyle.fontSize,
      labelOpacity: labelStyle.opacity,
      labelHaloColor: labelStyle.haloColor,
      labelHaloWidth: labelStyle.haloWidth,
      labelHaloBlur: labelStyle.haloBlur,
      labelHasUserStyle: labelStyle.hasUserStyle ? true : undefined,
      labelLetterSpacing: labelStyle.letterSpacing,
      labelMaxWidth: labelStyle.maxWidth,
      labelTextTransform: labelStyle.textTransform,
      labelJustify: labelStyle.textJustify,
    }));
  }

  Object.assign(properties, conditionalProps({ labelMinZoom: labelZoom?.minZoom, labelMaxZoom: labelZoom?.maxZoom }));
  const labelOffsetEm = getLabelOffsetEm(place.iconStyle, labelStyle);

  if (labelOffsetEm !== 1) properties.labelOffsetEm = labelOffsetEm;
  properties.markerOffsetLayout = getMarkerOffsetLayout(
    place.iconStyle, labelStyle?.fontSize, options.mapAlignedIcons ?? place.iconRotation !== undefined,
  ).id;
  const labelZIndex = labelStyle?.zIndex ?? place.iconStyle?.zIndex ?? 0;

  if (labelZIndex !== 0) properties.labelSortKey = -labelZIndex;

  return {
    type: 'Feature',
    id: getPlaceId(place),
    properties,
    geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
  };
}

export function createHtmlMarkerFeature(options: { place: MapPlace; iconImageId: string }): GeoJSON.Feature {
  const feature = createPointFeature(options);

  feature.properties = { ...feature.properties, mapPlace: JSON.stringify(options.place) };

  return feature;
}

export function updateTextLabelSource(map: maplibregl.Map, places: MapPlace[]): void {
  const features: GeoJSON.Feature[] = places.filter(place => {
    const style = place.labelStyle;

    return hasPlaceMarker(place) && style?.opacity !== 0 && !style?.inlineCss?.toLowerCase().includes('display: none') && !place.iconStyle?.zoom && !style?.zoom;
  }).map(place => {
    const style = place.labelStyle;
    const properties: Record<string, unknown> = {
      description: place.name || '',
      file_path: place.filePath || '',
      icon: place.icon || '',
      placeId: getPlaceId(place),
    };

    if (style) {
      Object.assign(properties, conditionalProps({
        labelColor: style.color,
        labelFontSize: style.fontSize,
        labelOpacity: style.opacity,
        labelHaloColor: style.haloColor,
        labelHaloWidth: style.haloWidth,
        labelHaloBlur: style.haloBlur,
        labelHasUserStyle: style.hasUserStyle ? true : undefined,
        labelLetterSpacing: style.letterSpacing,
        labelMaxWidth: style.maxWidth,
        labelTextTransform: style.textTransform,
        labelJustify: style.textJustify,
        labelMinZoom: style.zoom?.minZoom,
        labelMaxZoom: style.zoom?.maxZoom,
      }));
    }

    const offset = getLabelOffsetEm(place.iconStyle, style);

    if (offset !== 1) properties.labelOffsetEm = offset;

    return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] } };
  });

  void map.getSource<maplibregl.GeoJSONSource>('places-labels')?.setData({ type: 'FeatureCollection', features });
}
