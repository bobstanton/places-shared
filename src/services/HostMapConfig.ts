import { parseMapConfigPatch, resolveMapConfiguration, type ConfigWarning } from '../settings/MapConfigResolver';
import type { ResolvedMapConfig } from '../settings/MapConfiguration';
import type { IPlacesHostServices } from './IPlacesHostServices';

export function resolveHostMapConfig(host: IPlacesHostServices, blockSettings: Readonly<Record<string, unknown>>, placeCount: number,): { config: ResolvedMapConfig; clusteringEnabled: boolean } {
  const warnings: ConfigWarning[] = [];
  const providerName = typeof blockSettings.mapProvider === 'string' ? blockSettings.mapProvider : '';

  const resolved = host.maps.resolveMapConfig?.({ providerName, blockSettings, placeCount, warnings });
  if (resolved) return resolved;

  return {
    config: resolveMapConfiguration([{ source: 'block', values: parseMapConfigPatch(blockSettings, warnings) }]).config,
    clusteringEnabled: false,
  };
}
