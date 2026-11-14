import type * as GeoJSON from 'geojson';
import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';
import type { DirectionsOverlayRequest, IsochroneOverlayRequest, RouteWaypoint, RouteOverlayCapabilities, RouteOverlayService } from './IRouteOverlayService';
import { type OrsCompatibleRoutingProfile } from './OrsCompatibleSnapServiceBase';
export declare abstract class OrsCompatibleRouteOverlayServiceBase implements RouteOverlayService {
    protected extensionSettings: IPlaceExtensionSettings;
    protected constructor(extensionSettings: IPlaceExtensionSettings);
    abstract getProviderName(): string;
    getCapabilities(): RouteOverlayCapabilities;
    getDirectionsOverlay(request: DirectionsOverlayRequest): Promise<GeoJSON.FeatureCollection>;
    getIsochroneOverlay(request: IsochroneOverlayRequest): Promise<GeoJSON.FeatureCollection>;
    protected abstract callOrsCompatibleJson(operation: string, path: string, body: unknown, requestSummary?: string): Promise<unknown>;
    protected abstract getDirectionsPath(profile: OrsCompatibleRoutingProfile): string;
    protected abstract getIsochronePath(profile: OrsCompatibleRoutingProfile): string;
    protected supportsRouteOptimization(): boolean;
    protected optimizeRoute(route: RouteWaypoint[], profile: OrsCompatibleRoutingProfile): Promise<RouteWaypoint[]>;
    protected getRouteOptimizationUnsupportedMessage(): string;
}
