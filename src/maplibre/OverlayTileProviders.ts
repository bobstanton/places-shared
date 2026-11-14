const providersByPrefix = new Map<string, string>();

export function registerOverlayTileProvider(tiles: readonly string[], provider: string): void {
  for (const template of tiles) {
    const placeholder = template.indexOf('{');
    const prefix = placeholder === -1 ? template : template.slice(0, placeholder);

    if (prefix) providersByPrefix.set(prefix, provider);
  }
}

export function resolveOverlayTileProvider(url: string): string | undefined {
  let match: { prefix: string; provider: string } | undefined;

  for (const [prefix, provider] of providersByPrefix) {
    if (url.startsWith(prefix) && (!match || prefix.length > match.prefix.length)) match = { prefix, provider };
  }

  return match?.provider;
}
