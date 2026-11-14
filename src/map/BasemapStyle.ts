export interface BasemapStyle {
  value: string;
  name: string;
}

export type MapStyleKind = 'raster' | 'vector';

export const styleKindMap = (styles: ReadonlyArray<BasemapStyle>, kind: MapStyleKind): Record<string, MapStyleKind> =>
  Object.fromEntries(styles.map((style) => [style.value, kind]));

export const styleIds = (styles: ReadonlyArray<BasemapStyle>): string[] => styles.map((style) => style.value);
