import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';
import { describeUnsupportedSnapOptions, type ISnapService, type SnapRequest, type SnapResult } from './ISnapService';
import { formatProviderResponseShapeError } from './ProviderApiError';
import { mapTravelMode, toSnappedPoint } from './ProviderServiceHelpers';

export type OrsCompatibleRoutingProfile = 'driving-car' | 'foot-walking' | 'cycling-regular';

export const ORS_COMPATIBLE_PROFILES: { walk: OrsCompatibleRoutingProfile; bike: OrsCompatibleRoutingProfile; drive: OrsCompatibleRoutingProfile } = {
  walk: 'foot-walking',
  bike: 'cycling-regular',
  drive: 'driving-car',
};

interface OrsCompatibleSnapLocation {
  location?: number[];
}

// Base class for providers that expose the openrouteservice snap contract:
// ORS routing profiles plus a POST body containing `locations` and `radius`.
export abstract class OrsCompatibleSnapServiceBase implements ISnapService {
  protected constructor(protected extensionSettings: IPlaceExtensionSettings) {}

  abstract getProviderName(): string;

  // The openrouteservice snap contract is profile, locations, and radius: nothing else is accepted.
  describeUnsupportedRequest(request: SnapRequest): string[] {
    return describeUnsupportedSnapOptions(this.getProviderDisplayName(), request, {});
  }

  async snapPoints(request: SnapRequest): Promise<SnapResult> {
    const result = await this.callOrsCompatibleJson(
      'snap',
      this.getSnapPath(mapTravelMode(request.mode, ORS_COMPATIBLE_PROFILES)),
      {
        locations: request.points.map((point) => [point.longitude, point.latitude]),
        radius: request.radiusMeters ?? 300,
      },
      `${request.mode}, ${request.points.length} points, radius ${request.radiusMeters ?? 300}m`,
    ) as { locations?: Array<OrsCompatibleSnapLocation | null> };

    const locations = result.locations;
    if (!Array.isArray(locations) || locations.length !== request.points.length) {
      throw new Error(formatProviderResponseShapeError({
        provider: this.getProviderDisplayName(),
        operation: "snap",
        expected: "snapped locations",
        expectedCount: request.points.length,
        receivedCount: Array.isArray(locations) ? locations.length : 0,
        json: result,
        requestSummary: `${request.mode}, ${request.points.length} points`,
      }));
    }

    // /snap answers with snapped locations only; there is no matched geometry to return.
    return { points: locations.map((entry, index) => toSnappedPoint(entry?.location, request.points[index])) };
  }

  protected abstract callOrsCompatibleJson(operation: string, path: string, body: unknown, requestSummary?: string): Promise<unknown>;

  protected abstract getSnapPath(profile: OrsCompatibleRoutingProfile): string;

  protected getProviderDisplayName(): string {
    return this.getProviderName();
  }
}
