import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';
import type { RouteOverlayService } from './IRouteOverlayService';
import type { ISnapService } from './ISnapService';
import { type OrsCompatibleRoutingProfile } from './OrsCompatibleSnapServiceBase';
export interface OrsCompatibleJsonClient {
    postJson(operation: string, path: string, body: unknown, requestSummary?: string): Promise<unknown>;
}
export interface OrsCompatibleServicesOptions {
    providerName: string;
    client: OrsCompatibleJsonClient;
    directionsPath(profile: OrsCompatibleRoutingProfile): string;
    isochronePath(profile: OrsCompatibleRoutingProfile): string;
    snapPath(profile: OrsCompatibleRoutingProfile): string;
    routeOptimizationUnsupportedMessage?: string;
}
export interface OrsCompatibleServices {
    routeOverlay: RouteOverlayService;
    snap: ISnapService;
}
export declare function createOrsCompatibleServices(settings: IPlaceExtensionSettings, options: OrsCompatibleServicesOptions): OrsCompatibleServices;
