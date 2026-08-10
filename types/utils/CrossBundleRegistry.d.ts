export declare function sharedRegistryValue<T>(key: string | symbol, create: () => T): T;
export declare function sharedRegistryMap<K, V>(key: string | symbol): Map<K, V>;
export declare function nextSharedSequence(key: string | symbol): number;
