import { isStyleHidden, type MapPlace } from "../place/index";
import { buildIconSizeExpression, createPointIconLayout } from "../map/index";
import type * as maplibregl from 'maplibre-gl';

export function buildSymbolIconSizeExpression(zoomSizeStops: number[]): maplibregl.ExpressionSpecification {
  return buildIconSizeExpression(zoomSizeStops) as maplibregl.ExpressionSpecification;
}

export function symbolMarkerImage(pictures: boolean): maplibregl.ExpressionSpecification {
  if (!pictures) return ['get', 'glyphImage'];

  return ['coalesce', ['image', ['get', 'iconImage']], ['image', ['get', 'glyphImage']]];
}

export function buildSymbolMarkerLayout(zoomSizeStops: number[], mapAlignedIcons: boolean, iconOffset: unknown[] = ['literal', [0, 0]], pictures = true): NonNullable<maplibregl.SymbolLayerSpecification['layout']> {
  return {
    ...createPointIconLayout({
      image: symbolMarkerImage(pictures),
      size: buildSymbolIconSizeExpression(zoomSizeStops),
      rotate: ['coalesce', ['get', 'iconRotate'], 0],
      rotationAlignment: mapAlignedIcons ? 'map' : 'viewport',
    }),
    'icon-offset': iconOffset as maplibregl.ExpressionSpecification,
  };
}

function symbolZoomVisibilityConditions(minProp: string, maxProp: string): unknown[] {
  return [
    ['any', ['!', ['has', minProp]], ['>=', ['zoom'], ['get', minProp]]],
    ['any', ['!', ['has', maxProp]], ['<=', ['zoom'], ['get', maxProp]]],
  ];
}

const STACKED_BENEATH: maplibregl.ExpressionSpecification = ['<', ['coalesce', ['get', 'iconSortKey'], 0], 0];

export function symbolIconFilter(visibilityDeny: maplibregl.FilterSpecification | undefined, beneath: boolean): maplibregl.FilterSpecification {
  return [
    'all',
    beneath ? STACKED_BENEATH : ['!', STACKED_BENEATH],
    ...(visibilityDeny ? [visibilityDeny] : []),
    ['!', ['has', 'iconHidden']],
    ...symbolZoomVisibilityConditions('iconMinZoom', 'iconMaxZoom'),
  ] as maplibregl.FilterSpecification;
}

export function symbolLabelFilter(visibilityDeny?: maplibregl.FilterSpecification): maplibregl.FilterSpecification {
  return [
    'all',
    ...(visibilityDeny ? [visibilityDeny] : []),
    ['!', ['has', 'labelHidden']],
    ...symbolZoomVisibilityConditions('labelMinZoom', 'labelMaxZoom'),
  ] as maplibregl.FilterSpecification;
}

export function markerVisibilityDenyExpression(hiddenPlaceIds: readonly string[]): maplibregl.FilterSpecification | undefined {
  if (hiddenPlaceIds.length === 0) return undefined;

  return ['!', ['in', ['get', 'placeId'], ['literal', [...hiddenPlaceIds]]]] as unknown as maplibregl.FilterSpecification;
}

export function isIconHidden(place: MapPlace | undefined): boolean {
  return place?.markerEnabled === false || isStyleHidden(place?.iconStyle);
}
