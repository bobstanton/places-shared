import { PLACES_EXTENSION_API_VERSION, type IPlacePluginExtensionExports } from './IPlacePluginExtension';

export function settingsOnlyExports(settingsGroup: IPlacePluginExtensionExports['settingsGroup']): IPlacePluginExtensionExports {
  return { apiVersion: PLACES_EXTENSION_API_VERSION, settingsGroup };
}
