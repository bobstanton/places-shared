export const PLACES_EXPORTS_FOLDER = 'Places Exports';

export function normalizeVaultPath(path: string): string {
  const normalized = path
    .replace(/([\\/])+/g, '/')
    .replace(/(^\/+|\/+$)/g, '')
    .replace(/\u00A0|\u202F/g, ' ')
    .normalize('NFC');

  return normalized || '/';
}

export const ABSOLUTE_DEVICE_PATH = /^(?:[/\\]|[A-Za-z]:[/\\])/;
export const REMOTE_URL = /^(?:[a-z][a-z0-9+.-]*:\/\/|(?:data|blob|mailto):)/i;

export function isVaultPath(path: string): boolean {
  const trimmed = path.trim();

  return trimmed.length > 0 && !ABSOLUTE_DEVICE_PATH.test(trimmed) && !REMOTE_URL.test(trimmed);
}
