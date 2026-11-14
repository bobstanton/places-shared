import type { ComputedIconStyle } from '../Place';
import { getMarkerIconGeometry, getMarkerLabelAnchorOffsets } from './MarkerIconGeometry';

export interface MarkerOffsetLayout {
  id: string;
  iconOffset: [number, number];
  labelAnchorOffsets: Array<string | [number, number]>;
}

export function getMarkerOffsetLayout(style: ComputedIconStyle | undefined, fontSize = 14, mapAligned = false): MarkerOffsetLayout {
  const { left, right, top, bottom, offsetX, offsetY } = getMarkerIconGeometry(style);

  return {
    id: [left, right, top, bottom, fontSize, Number(mapAligned)].join(','),
    iconOffset: [offsetX, offsetY],
    labelAnchorOffsets: getMarkerLabelAnchorOffsets(style, fontSize, mapAligned),
  };
}

// MapLibre evaluates layout expressions before decoding array-valued properties.
export function buildMarkerOffsetExpressions(layouts: Iterable<MarkerOffsetLayout>): {
  iconOffset: unknown[];
  labelAnchorOffsets: unknown[];
} {
  const unique = new Map(Array.from(layouts, layout => [layout.id, layout]));
  const fallback = getMarkerOffsetLayout(undefined);
  const expression = (property: 'iconOffset' | 'labelAnchorOffsets'): unknown[] => {
    if (unique.size === 0) return ['literal', fallback[property]];
    const result: unknown[] = ['match', ['get', 'markerOffsetLayout']];

    for (const [id, layout] of unique) result.push(id, ['literal', layout[property]]);
    result.push(['literal', fallback[property]]);

    return result;
  };

  return { iconOffset: expression('iconOffset'), labelAnchorOffsets: expression('labelAnchorOffsets') };
}
