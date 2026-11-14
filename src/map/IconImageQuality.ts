export type IconImageDetail = 'standard' | 'sharp' | 'maximum';

export const ICON_IMAGE_DETAILS = ['standard', 'sharp', 'maximum'] as const;

export interface IconImageQuality {
  pixelRatio: number;
  decodePx: number;
}

const QUALITY: Record<IconImageDetail, IconImageQuality> = {
  standard: Object.freeze({ pixelRatio: 1, decodePx: 192 }),
  sharp: Object.freeze({ pixelRatio: 2, decodePx: 384 }),
  maximum: Object.freeze({ pixelRatio: 3, decodePx: 576 }),
};

export const DEFAULT_ICON_IMAGE_QUALITY = QUALITY.standard;

export function resolveIconImageQuality(detail: string | undefined): IconImageQuality {
  return QUALITY[detail as IconImageDetail] ?? DEFAULT_ICON_IMAGE_QUALITY;
}
