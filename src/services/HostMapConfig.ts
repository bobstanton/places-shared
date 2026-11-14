import { parseMapConfigPatch, resolveMapConfiguration, type ConfigWarning } from '../settings/index';
import type { ResolvedMapConfig } from '../settings/index';
import type { MapHostServices } from './MapHostServices';

export function resolveHostMapConfig(host: MapHostServices, blockSettings: Readonly<Record<string, unknown>>, placeCount: number,): { config: ResolvedMapConfig; clusteringEnabled: boolean } {
  const warnings: ConfigWarning[] = [];
  const providerName = typeof blockSettings.mapProvider === 'string' ? blockSettings.mapProvider : '';

  const resolved = host.maps.resolveMapConfig?.({ providerName, blockSettings, placeCount, warnings });

  if (resolved) return resolved;

  return {
    config: resolveMapConfiguration([{ source: 'block', values: parseMapConfigPatch(blockSettings) }]).config,
    clusteringEnabled: false,
  };
}
