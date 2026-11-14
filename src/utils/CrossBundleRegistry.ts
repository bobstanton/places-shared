type GlobalHost = Record<string | symbol, unknown>;

const host = globalThis as unknown as GlobalHost;

export function sharedRegistryValue<T>(key: string | symbol, create: () => T): T {
  return (host[key] ??= create()) as T;
}

export function sharedRegistryMap<K, V>(key: string | symbol): Map<K, V> {
  return sharedRegistryValue(key, () => new Map<K, V>());
}

export function nextSharedSequence(key: string | symbol): number {
  const next = ((host[key] as number | undefined) ?? 0) + 1;

  host[key] = next;

  return next;
}
