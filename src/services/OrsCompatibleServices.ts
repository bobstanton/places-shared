import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';
import type { RouteOverlayService } from './IRouteOverlayService';
import type { ISnapService } from './ISnapService';
import { OrsCompatibleRouteOverlayServiceBase } from './OrsCompatibleRouteOverlayServiceBase';
import { OrsCompatibleSnapServiceBase, type OrsCompatibleRoutingProfile } from './OrsCompatibleSnapServiceBase';

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

export function createOrsCompatibleServices(
  settings: IPlaceExtensionSettings,
  options: OrsCompatibleServicesOptions,
): OrsCompatibleServices {
  class RouteService extends OrsCompatibleRouteOverlayServiceBase {
    constructor() { super(settings); }
    getProviderName(): string { return options.providerName; }
    protected getDirectionsPath(profile: OrsCompatibleRoutingProfile): string { return options.directionsPath(profile); }
    protected getIsochronePath(profile: OrsCompatibleRoutingProfile): string { return options.isochronePath(profile); }
    protected getRouteOptimizationUnsupportedMessage(): string {
      return options.routeOptimizationUnsupportedMessage ?? `${options.providerName} does not offer route optimization.`;
    }
    protected callOrsCompatibleJson(operation: string, path: string, body: unknown, requestSummary?: string): Promise<unknown> {
      return options.client.postJson(operation, path, body, requestSummary);
    }
  }

  class SnapService extends OrsCompatibleSnapServiceBase {
    constructor() { super(settings); }
    getProviderName(): string { return options.providerName; }
    protected getSnapPath(profile: OrsCompatibleRoutingProfile): string { return options.snapPath(profile); }
    protected callOrsCompatibleJson(operation: string, path: string, body: unknown, requestSummary?: string): Promise<unknown> {
      return options.client.postJson(operation, path, body, requestSummary);
    }
  }

  return { routeOverlay: new RouteService(), snap: new SnapService() };
}
