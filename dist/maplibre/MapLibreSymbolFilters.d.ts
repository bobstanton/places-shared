import { type MapPlace } from "../place/index";
import type * as maplibregl from 'maplibre-gl';
export declare function buildSymbolIconSizeExpression(zoomSizeStops: number[]): maplibregl.ExpressionSpecification;
export declare function symbolMarkerImage(pictures: boolean): maplibregl.ExpressionSpecification;
export declare function buildSymbolMarkerLayout(zoomSizeStops: number[], mapAlignedIcons: boolean, iconOffset?: unknown[], pictures?: boolean): NonNullable<maplibregl.SymbolLayerSpecification['layout']>;
export declare function symbolIconFilter(visibilityDeny: maplibregl.FilterSpecification | undefined, beneath: boolean): maplibregl.FilterSpecification;
export declare function symbolLabelFilter(visibilityDeny?: maplibregl.FilterSpecification): maplibregl.FilterSpecification;
export declare function markerVisibilityDenyExpression(hiddenPlaceIds: readonly string[]): maplibregl.FilterSpecification | undefined;
export declare function isIconHidden(place: MapPlace | undefined): boolean;
