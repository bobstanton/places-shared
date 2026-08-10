import type { Coordinate } from '../geo/DistanceCalculator';
import type { RouteTravelMode } from './IRouteOverlayService';
import type { SnappedPoint } from './ISnapService';
import { type IPlacePluginExtensionExports } from './IPlacePluginExtension';
export declare function settingsOnlyExports(settingsGroup: IPlacePluginExtensionExports['settingsGroup']): IPlacePluginExtensionExports;
export declare function assertProviderApiKey(apiKey: string | undefined, providerDisplayName: string): void;
export declare function mapTravelMode<T>(mode: RouteTravelMode, names: {
    walk: T;
    bike: T;
    drive: T;
}): T;
export declare function toSnappedPoint(location: number[] | null | undefined, original: Coordinate): SnappedPoint;
