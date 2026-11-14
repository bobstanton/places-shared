import { createPointIconLayout } from './PointIconLayer';
import { MARKER_ICON_SIZE_PX, PLAIN_MARKER_IMAGE_PREFIX } from './MarkerIconImage';
import { WAYPOINT_ICON_PROPERTY } from './WaypointIcon';
import { WAYPOINT_MARKER_IMAGE_ID, WAYPOINT_MARKER_SDF_RADIUS_PX } from './WaypointMarkerImage';

export const DEFAULT_MAP_LABEL_COLOR = '#d73027';
export const DEFAULT_ROUTE_LABEL_COLOR = DEFAULT_MAP_LABEL_COLOR;
export const WAYPOINT_EMOJI_SIZE_PX = 20;

export function createMapLabelPaint(defaultColor = DEFAULT_MAP_LABEL_COLOR): Record<string, unknown> {
  const baseOpacity = [
    'case',
    ['has', 'labelOpacity'],
    ['get', 'labelOpacity'],
    1
  ];
  const hasUserLabelStyle = ['has', 'labelHasUserStyle'];

  return {
    'text-color': [
      'case',
      ['has', 'labelColor'],
      ['get', 'labelColor'],
      defaultColor
    ],
    'text-opacity': baseOpacity,
    'text-halo-blur': [
      'case',
      ['has', 'labelHaloBlur'],
      ['get', 'labelHaloBlur'],
      hasUserLabelStyle,
      0,
      0.5
    ],
    'text-halo-color': [
      'case',
      ['has', 'labelHaloColor'],
      ['get', 'labelHaloColor'],
      hasUserLabelStyle,
      'rgba(255,255,255,1)',
      'rgba(255,255,255,0.9)'
    ],
    'text-halo-width': [
      'case',
      ['has', 'labelHaloWidth'],
      ['get', 'labelHaloWidth'],
      hasUserLabelStyle,
      0,
      1.25
    ]
  };
}

export const POINT_LABEL_VARIABLE_ANCHORS = [
  'left',
  'right',
  'bottom',
  'top',
] as const;

export interface PointLabelLayerOptions {
  sourceId: string;
  layerId?: string;
  filter?: unknown;
  textField?: unknown;
  defaultColor?: string;
  textOverlap?: 'never' | 'always' | 'cooperative';
  variableAnchorOffsets?: unknown[];
}

export interface PointLabelLayerConfig {
  id: string;
  type: 'symbol';
  source: string;
  filter?: unknown;
  layout: Record<string, unknown>;
  paint: Record<string, unknown>;
}

export function createPointLabelLayerConfig(options: PointLabelLayerOptions): PointLabelLayerConfig {
  const layout: Record<string, unknown> = {
    'text-field': options.textField ?? ['get', 'description'],
    'text-anchor': 'left',
    'text-variable-anchor': [...POINT_LABEL_VARIABLE_ANCHORS],
    'text-radial-offset': ['+', ['coalesce', ['get', 'labelOffsetEm'], 1],
      ['/', 6, ['coalesce', ['get', 'labelFontSize'], 14]]],
    'text-size': ['case', ['has', 'labelFontSize'], ['get', 'labelFontSize'], 14],
    'text-transform': ['case', ['has', 'labelTextTransform'], ['get', 'labelTextTransform'], 'none'],
    'text-letter-spacing': ['case', ['has', 'labelLetterSpacing'], ['get', 'labelLetterSpacing'], 0],
    'text-max-width': ['case', ['has', 'labelMaxWidth'], ['get', 'labelMaxWidth'], 10],
    'text-justify': ['case', ['has', 'labelJustify'], ['get', 'labelJustify'], 'auto'],
    'text-optional': true,
    'symbol-sort-key': ['case', ['has', 'labelSortKey'], ['get', 'labelSortKey'], 0],
  };

  if (options.textOverlap) layout['text-overlap'] = options.textOverlap;

  if (options.variableAnchorOffsets) {
    delete layout['text-variable-anchor'];
    delete layout['text-radial-offset'];
    layout['text-variable-anchor-offset'] = options.variableAnchorOffsets;
  }

  return {
    id: options.layerId ?? 'places-markers',
    type: 'symbol',
    source: options.sourceId,
    ...(options.filter !== undefined ? { filter: options.filter } : {}),
    layout,
    paint: createMapLabelPaint(options.defaultColor ?? DEFAULT_MAP_LABEL_COLOR),
  };
}

export function createRouteLabelPaint(defaultColor = DEFAULT_ROUTE_LABEL_COLOR): Record<string, unknown> {
  return {
    'text-color': defaultColor,
    'text-opacity': 1,
    'text-halo-blur': 1,
    'text-halo-color': 'rgba(255,255,255,0.75)',
    'text-halo-width': 1
  };
}

export function createRouteLabelLayerConfig(options: {
  sourceId: string;
  layerId?: string;
  defaultColor?: string;
}): Record<string, unknown> {
  return {
    id: options.layerId ?? `${options.sourceId}-route-label`,
    type: 'symbol',
    source: options.sourceId,
    filter: ['all', ['has', 'route_label'], ['has', 'route_label_point'], ['==', ['geometry-type'], 'Point']],
    layout: {
      'text-field': ['get', 'route_label'],
      'text-size': [
        'case',
        ['has', 'route_label_font_size'],
        ['get', 'route_label_font_size'],
        14
      ],
      'text-anchor': 'left',
      'text-offset': [0.6, 0],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-optional': true
    },
    paint: createRouteLabelPaint(options.defaultColor ?? DEFAULT_ROUTE_LABEL_COLOR)
  };
}

export function createRouteEndpointLabelLayerConfig(options: {
  sourceId: string;
  layerId?: string;
  defaultColor?: string;
}): Record<string, unknown> {
  return {
    id: options.layerId ?? `${options.sourceId}-route-endpoint-label`,
    type: 'symbol',
    source: options.sourceId,
    filter: ['all', ['has', 'route_endpoint_label'], ['==', ['geometry-type'], 'Point']],
    layout: {
      'text-field': ['get', 'route_endpoint_label'],
      'text-size': 13,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-rotation-alignment': 'viewport',
      'text-pitch-alignment': 'viewport',
      'text-optional': true
    },
    paint: createMapLabelPaint(options.defaultColor ?? DEFAULT_MAP_LABEL_COLOR)
  };
}

export function createWaypointLayerConfig(options: {
  sourceId: string;
  layerId?: string;
  trackColor: string;
  excludeProperties?: readonly string[];
  filter?: unknown;
  defaultRadius?: unknown;
  defaultOpacity?: unknown;
  defaultStrokeColor?: unknown;
  defaultStrokeWidth?: unknown;
}): Record<string, unknown> {
  const exclusions = (options.excludeProperties ?? ['route_label_point']).map(
    property => ['!', ['has', property]],
  );
  const baseFilter = options.filter ?? ['all', ['==', ['geometry-type'], 'Point'], ...exclusions];

  return {
    id: options.layerId ?? `${options.sourceId}-points`,
    type: 'symbol',
    source: options.sourceId,
    filter: ['all', baseFilter, ['!', ['has', WAYPOINT_ICON_PROPERTY]]],
    layout: createPointIconLayout({
      image: WAYPOINT_MARKER_IMAGE_ID,
      size: ['/', ['coalesce', ['get', 'circle-radius'], options.defaultRadius ?? 5], WAYPOINT_MARKER_SDF_RADIUS_PX],
    }),
    paint: {
      'icon-color': ['coalesce', ['get', 'marker-color'], options.trackColor],
      'icon-opacity': ['coalesce', ['get', 'fill-opacity'], options.defaultOpacity ?? 0.9],
      'icon-halo-color': ['coalesce', ['get', 'stroke'], options.defaultStrokeColor ?? '#fff'],
      'icon-halo-width': ['coalesce', ['get', 'stroke-width'], options.defaultStrokeWidth ?? 2],
    }
  };
}

// MapLibre cannot mix SDF and non-SDF images in one symbol buffer.
export function createWaypointEmojiLayerConfig(options: {
  sourceId: string;
  layerId?: string;
  excludeProperties?: readonly string[];
  filter?: unknown;
  defaultOpacity?: unknown;
}): Record<string, unknown> {
  const exclusions = (options.excludeProperties ?? ['route_label_point']).map(
    property => ['!', ['has', property]],
  );
  const baseFilter = options.filter ?? ['all', ['==', ['geometry-type'], 'Point'], ...exclusions];

  return {
    id: options.layerId ?? `${options.sourceId}-points-emoji`,
    type: 'symbol',
    source: options.sourceId,
    filter: ['all', baseFilter, ['has', WAYPOINT_ICON_PROPERTY]],
    layout: createPointIconLayout({
      image: ['concat', PLAIN_MARKER_IMAGE_PREFIX, ['get', WAYPOINT_ICON_PROPERTY]],
      size: WAYPOINT_EMOJI_SIZE_PX / MARKER_ICON_SIZE_PX,
    }),
    paint: {
      'icon-opacity': ['coalesce', ['get', 'fill-opacity'], options.defaultOpacity ?? 0.9],
    },
  };
}

export function createWaypointLabelLayerConfig(options: {
  sourceId: string;
  layerId?: string;
  defaultColor?: string;
  excludeProperties?: readonly string[];
}): PointLabelLayerConfig {
  const exclusions = (options.excludeProperties ?? ['route_label_point']).map(
    property => ['!', ['has', property]],
  );

  return createPointLabelLayerConfig({
    sourceId: options.sourceId,
    layerId: options.layerId ?? `${options.sourceId}-points-label`,
    filter: ['all', ['==', ['geometry-type'], 'Point'], ...exclusions, ['has', 'name']],
    textField: ['get', 'name'],
    defaultColor: options.defaultColor,
  });
}

export function createPathLabelLayerConfig(options: {
  sourceId: string;
  layerId?: string;
  defaultColor?: string;
}): Record<string, unknown> {
  return {
    id: options.layerId ?? `${options.sourceId}-route-label`,
    type: 'symbol',
    source: options.sourceId,
    filter: ['all', ['has', 'route_label'], ['has', 'route_label_point'], ['==', ['geometry-type'], 'Point']],
    layout: {
      'text-field': ['get', 'route_label'],
      'text-size': 14,
      'text-anchor': ['match', ['get', 'route_label_role'], 'start', 'top', 'left'],
      'text-offset': ['match', ['get', 'route_label_role'], 'start', ['literal', [0, 1]], ['literal', [0.6, 0]]],
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-optional': true
    },
    paint: createMapLabelPaint(options.defaultColor ?? DEFAULT_MAP_LABEL_COLOR)
  };
}
