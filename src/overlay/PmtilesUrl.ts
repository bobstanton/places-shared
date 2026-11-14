export const PMTILES_PROTOCOL = 'pmtiles';

export const PMTILES_VAULT_PREFIX = `${PMTILES_PROTOCOL}://vault/`;

export function pmtilesVaultUrl(vaultPath: string): string {
  return `${PMTILES_VAULT_PREFIX}${vaultPath.replace(/^\/+/, '')}`;
}

export function pmtilesRemoteUrl(url: string | undefined): string | undefined {
  if (url === undefined || isPmtilesUrl(url)) return url;

  return isPmtilesPath(url.split('?')[0]) ? `${PMTILES_PROTOCOL}://${url}` : url;
}

export function isPmtilesUrl(url: string): boolean {
  return url.startsWith(`${PMTILES_PROTOCOL}://`);
}

export function pmtilesVaultPath(url: string): string | undefined {
  return url.startsWith(PMTILES_VAULT_PREFIX) ? url.slice(PMTILES_VAULT_PREFIX.length) : undefined;
}

export function pmtilesArchiveKey(url: string): string {
  return url.slice(`${PMTILES_PROTOCOL}://`.length);
}

export function isPmtilesPath(path: string): boolean {
  return /\.pmtiles$/i.test(path);
}
