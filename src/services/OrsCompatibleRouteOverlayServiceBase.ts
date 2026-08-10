import type * as GeoJSON from 'geojson';
import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';
import {
  appendDirectionsRouteFeatures,
  buildDirectionsRouteFeature,
  buildRouteLegMetrics,
  decorateIsochroneFeatureProperties,
  formatIsochroneFeatureName,
  formatRouteDistance,
  getIsochroneStyleColors,
} from './RouteOverlayGeoJson';
import type {
  DirectionsOverlayRequest,
  IsochroneOverlayRequest,
  RouteWaypoint,
  RouteOverlayCapabilities,
  RouteOverlayService,
} from './IRouteOverlayService';
import { ORS_COMPATIBLE_PROFILES, type OrsCompatibleRoutingProfile } from './OrsCompatibleSnapServiceBase';
import { assertProviderApiKey, mapTravelMode } from './ProviderServiceHelpers';

// Base class for ORS-compatible route overlay providers: GeoJSON directions,
// ORS routing profile names, and isochrone ranges expressed as seconds/meters.
export abstract class OrsCompatibleRouteOverlayServiceBase implements RouteOverlayService {
  protected constructor(protected extensionSettings: IPlaceExtensionSettings) {}

  abstract getProviderName(): string;

  getCapabilities(): RouteOverlayCapabilities {
    return {
      routeOptimization: this.supportsRouteOptimization(),
      distanceIsochrones: true,
      polygonIsochrones: true,
    };
  }

  async getDirectionsOverlay(request: DirectionsOverlayRequest): Promise<GeoJSON.FeatureCollection> {
    assertProviderApiKey(this.extensionSettings.apiKey, this.getProviderName());
    if (request.optimize && !this.supportsRouteOptimization()) {
      throw new Error(this.getRouteOptimizationUnsupportedMessage());
    }

    const features: GeoJSON.Feature[] = [];

    for (let index = 0; index < request.routes.length; index++) {
      const route = request.routes[index];
      if (route.length < 2) continue;

      const profile = mapTravelMode(request.mode, ORS_COMPATIBLE_PROFILES);
      const orderedRoute = request.optimize
        ? await this.optimizeRoute(route, profile)
        : route;
      const result = await this.callOrsCompatibleJson(
        'directions',
        this.getDirectionsPath(profile),
        { coordinates: orderedRoute.map((point) => [point.longitude, point.latitude]) },
        `${request.mode}, ${orderedRoute.length} waypoint${orderedRoute.length === 1 ? '' : 's'}`,
      ) as GeoJSON.FeatureCollection;

      const routeGeometry = result.features?.[0];
      if (!routeGeometry || routeGeometry.geometry?.type !== 'LineString') continue;

      const routeProperties = routeGeometry.properties as { summary?: { distance?: number; duration?: number }; segments?: Array<{ distance?: number; duration?: number }> } | null;
      const summary = routeProperties?.summary;
      const legs = buildRouteLegMetrics(orderedRoute, (routeProperties?.segments ?? []).map(segment => ({
        distanceMeters: Number(segment.distance ?? 0),
        durationSeconds: Number(segment.duration ?? 0),
      })));

      await appendDirectionsRouteFeatures(features, buildDirectionsRouteFeature({
        request,
        provider: this.getProviderName(),
        routeIndex: index,
        route: orderedRoute,
        geometry: routeGeometry.geometry,
        optimized: request.optimize === true,
        distanceMeters: Number(summary?.distance ?? 0),
        durationSeconds: Number(summary?.duration ?? 0),
        legs,
      }), request);
    }

    return { type: 'FeatureCollection', features };
  }

  async getIsochroneOverlay(request: IsochroneOverlayRequest): Promise<GeoJSON.FeatureCollection> {
    assertProviderApiKey(this.extensionSettings.apiKey, this.getProviderName());
    const features: GeoJSON.Feature[] = [];

    for (const center of request.centers) {
      const colors = getIsochroneStyleColors(request.ranges.length, request.style);
      const ranges = request.rangeType === 'time' ? request.ranges.map((range) => range * 60) : request.ranges;

      const result = await this.callOrsCompatibleJson(
        'isochrones',
        this.getIsochronePath(mapTravelMode(request.mode, ORS_COMPATIBLE_PROFILES)),
        {
          locations: [[center.longitude, center.latitude]],
          range: ranges,
          range_type: request.rangeType,
        },
        `${request.mode}, ${request.rangeType} ranges ${request.ranges.join(', ')}`,
      ) as GeoJSON.FeatureCollection;

      for (const feature of result.features ?? []) {
        const value = Number(feature.properties?.value ?? 0);
        const rangeIndex = Math.max(0, ranges.indexOf(value));
        const contour = request.rangeType === 'time' ? value / 60 : value;
        const color = colors[rangeIndex] ?? colors[0] ?? '#4f46e5';
        features.push({
          ...feature,
          properties: decorateIsochroneFeatureProperties({
            ...(feature.properties ?? {}),
            name: formatIsochroneFeatureName(request.name ?? center.name, request.mode, request.rangeType === 'time' ? `${contour} min` : formatRouteDistance(contour)),
            provider: this.getProviderName(),
            metric: request.rangeType,
            contour,
          }, color, request.style),
        });
      }
    }

    return { type: 'FeatureCollection', features };
  }

  protected abstract callOrsCompatibleJson(operation: string, path: string, body: unknown, requestSummary?: string): Promise<unknown>;

  protected abstract getDirectionsPath(profile: OrsCompatibleRoutingProfile): string;

  protected abstract getIsochronePath(profile: OrsCompatibleRoutingProfile): string;

  protected supportsRouteOptimization(): boolean {
    return false;
  }

  protected optimizeRoute(_route: RouteWaypoint[], _profile: OrsCompatibleRoutingProfile): Promise<RouteWaypoint[]> {
    return Promise.reject(new Error(this.getRouteOptimizationUnsupportedMessage()));
  }

  protected getRouteOptimizationUnsupportedMessage(): string {
    return `${this.getProviderName()} route optimization is not supported.`;
  }
}
