import type { IconImageQuality } from './IconImageQuality';
import type { ComputedIconStyle } from '../Place';
import { getMarkerIconGeometry, getMaxIconScale, MARKER_ICON_SIZE_PX } from './MarkerIconGeometry';
import { drawMarkerShape, getMarkerShapeSize, GLYPH_EM_RATIO } from './MarkerShape';
import { drawMarkerPicture, getMarkerPicture, markerPictureImageId } from './MarkerPicture';
import { hashString36 } from '../utils/Utilities';
import { sharedRegistryValue } from '../utils/CrossBundleRegistry';

export { MARKER_ICON_SIZE_PX } from './MarkerIconGeometry';

export const PLAIN_MARKER_IMAGE_PREFIX = 'places-emoji-';

export interface MarkerImageTarget {
  hasImage(id: string): boolean;
  addImage(id: string, image: ImageData, options?: { pixelRatio?: number }): void;
}

export interface MarkerIconImageHost {
  createCanvas(): HTMLCanvasElement | null;
  pixelRatio: number;
}

export interface MarkerIconImageResult {
  imageId: string;
  outcome: 'existing' | 'cache' | 'rasterized' | 'failed';
}

interface CacheEntry {
  imageData: ImageData;
  pixelRatio: number;
}

interface ImageCache {
  entries: Map<string, CacheEntry>;
  limit: number;
}

const CACHE_KEY = Symbol.for('places.marker.icon.images');
const CACHE_LIMIT = 1024;

function imageCache(): ImageCache {
  return sharedRegistryValue<ImageCache>(CACHE_KEY, () => ({ entries: new Map(), limit: CACHE_LIMIT }));
}

export function markerIconImageId(icon: string, style: ComputedIconStyle | undefined): string {
  const badge = style?.badge;
  const shadows = style?.shadows;
  const color = style?.color;
  const shape = style?.shape;
  const imageScale = getMaxIconScale(style);

  if (!badge && !shadows?.length && !color && !shape && imageScale === 1) return PLAIN_MARKER_IMAGE_PREFIX + icon;

  return `places-icon-${hashString36(JSON.stringify({ icon, badge, shadows, shape, imageScale, color, layout: 2 }))}`;
}

export function ensureMarkerIconImage(map: MarkerImageTarget, icon: string, style: ComputedIconStyle | undefined, host: MarkerIconImageHost, imageId = markerIconImageId(icon, style)): MarkerIconImageResult {
  const pixelRatio = Math.min(host.pixelRatio || 1, 3);

  return ensureMarkerImage(map, imageId, style, host, pixelRatio, () => (context, geometry) => {
    const badge = style?.badge;
    const shadows = style?.shadows ?? [];
    const { imageScale, badgeOffsetX, badgeOffsetY, left, top } = geometry;

    const iconColor = style?.color;
    const drawGlyph = (glyph: string, fontPx: number, alpha: number, offsetXPx = 0, offsetYPx = 0, color?: string): void => {
      context.font = `${Math.floor(fontPx * GLYPH_EM_RATIO)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.globalAlpha = alpha;
      context.fillStyle = color ?? '#000';
      context.fillText(glyph, -left * pixelRatio + offsetXPx, -top * pixelRatio + offsetYPx + fontPx * 0.04);
      context.globalAlpha = 1;
    };

    const iconFontPx = MARKER_ICON_SIZE_PX * imageScale * pixelRatio;
    const badgeFontPx = badge ? iconFontPx * badge.sizePct / 100 : 0;

    if (style?.shape) {
      drawMarkerShape(context, style.shape, {
        centerX: -left * pixelRatio,
        centerY: -top * pixelRatio,
        size: getMarkerShapeSize(MARKER_ICON_SIZE_PX * imageScale) * pixelRatio,
      }, pixelRatio);
    }

    if (badge && badge.order === 'behind') {
      drawGlyph(badge.content, badgeFontPx, badge.opacity, badgeOffsetX * pixelRatio, badgeOffsetY * pixelRatio);
    }

    if (shadows.length > 0) {
      for (const shadow of shadows) {
        context.shadowOffsetX = shadow.offsetX * pixelRatio;
        context.shadowOffsetY = shadow.offsetY * pixelRatio;
        context.shadowBlur = shadow.blur * pixelRatio;
        context.shadowColor = shadow.color;
        drawGlyph(icon, iconFontPx, 1, 0, 0, iconColor);
      }

      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
    } else {
      drawGlyph(icon, iconFontPx, 1, 0, 0, iconColor);
    }

    if (badge && badge.order === 'front') {
      drawGlyph(badge.content, badgeFontPx, badge.opacity, badgeOffsetX * pixelRatio, badgeOffsetY * pixelRatio);
    }
  });
}

export function ensureMarkerPictureImage(
  map: MarkerImageTarget,
  url: string,
  style: ComputedIconStyle | undefined,
  host: MarkerIconImageHost,
  quality: IconImageQuality,
  imageId = markerPictureImageId(url, style, quality),
): MarkerIconImageResult {
  const pixelRatio = Math.min(host.pixelRatio || 1, quality.pixelRatio);

  return ensureMarkerImage(map, imageId, style, host, pixelRatio, () => {
    const picture = getMarkerPicture(url, quality.decodePx);

    if (!picture) return undefined;

    return (context, { imageScale, left, top }) => {
      const box = {
        centerX: -left * pixelRatio,
        centerY: -top * pixelRatio,
        size: getMarkerShapeSize(MARKER_ICON_SIZE_PX * imageScale) * pixelRatio,
      };

      drawMarkerPicture(context as unknown as Parameters<typeof drawMarkerPicture>[0], picture, box, style?.shape, pixelRatio);
      if (style?.shape?.stroke) drawMarkerShape(context, { ...style.shape, fill: undefined }, box, pixelRatio);
    };
  });
}

type MarkerPainter = (context: CanvasRenderingContext2D, geometry: ReturnType<typeof getMarkerIconGeometry>) => void;

function ensureMarkerImage(
  map: MarkerImageTarget,
  imageId: string,
  style: ComputedIconStyle | undefined,
  host: MarkerIconImageHost,
  pixelRatio: number,
  prepareDraw: () => MarkerPainter | undefined,
): MarkerIconImageResult {
  if (map.hasImage(imageId)) return { imageId, outcome: 'existing' };

  const cache = imageCache();
  const cached = cache.entries.get(imageId);

  if (cached?.pixelRatio === pixelRatio) {
    map.addImage(imageId, cached.imageData, { pixelRatio });

    return { imageId, outcome: 'cache' };
  }

  const draw = prepareDraw();

  if (!draw) return { imageId, outcome: 'failed' };
  const geometry = getMarkerIconGeometry(style);
  const canvasWidth = Math.ceil(geometry.width * pixelRatio);
  const canvasHeight = Math.ceil(geometry.height * pixelRatio);
  const canvas = host.createCanvas();

  if (!canvas) return { imageId, outcome: 'failed' };
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) return { imageId, outcome: 'failed' };

  draw(context, geometry);
  const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);

  map.addImage(imageId, imageData, { pixelRatio });
  cache.entries.delete(imageId);
  cache.entries.set(imageId, { imageData, pixelRatio });

  if (cache.entries.size > cache.limit) {
    const oldest = cache.entries.keys().next().value;

    if (oldest !== undefined) cache.entries.delete(oldest);
  }

  return { imageId, outcome: 'rasterized' };
}
