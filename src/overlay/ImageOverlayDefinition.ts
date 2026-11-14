export const IMAGE_OVERLAY_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif'] as const;
const imageExtensions = new Set<string>(IMAGE_OVERLAY_FILE_EXTENSIONS);

export function isImageOverlayPath(path: string): boolean {
  if (/^data:image\//i.test(path)) return true;
  const cleanPath = /^https?:\/\//i.test(path) ? path.split(/[?#]/)[0] : path;
  const extension = cleanPath.trim().match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();

  return extension !== undefined && imageExtensions.has(extension);
}

export function isImageOverlayDefinition(entry: Readonly<Record<string, unknown>>): boolean {
  if (entry.type !== undefined) return entry.type === 'image';

  return Boolean(entry.bounds || entry.corners)
    || (typeof entry.path === 'string' && isImageOverlayPath(entry.path));
}
