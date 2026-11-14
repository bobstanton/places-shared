import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';
import { type ISnapService, type SnapRequest, type SnapResult } from './ISnapService';
export type OrsCompatibleRoutingProfile = 'driving-car' | 'foot-walking' | 'cycling-regular';
export declare const ORS_COMPATIBLE_PROFILES: {
    walk: OrsCompatibleRoutingProfile;
    bike: OrsCompatibleRoutingProfile;
    drive: OrsCompatibleRoutingProfile;
};
export declare abstract class OrsCompatibleSnapServiceBase implements ISnapService {
    protected extensionSettings: IPlaceExtensionSettings;
    protected constructor(extensionSettings: IPlaceExtensionSettings);
    abstract getProviderName(): string;
    describeUnsupportedRequest(request: SnapRequest): string[];
    snapPoints(request: SnapRequest): Promise<SnapResult>;
    protected abstract callOrsCompatibleJson(operation: string, path: string, body: unknown, requestSummary?: string): Promise<unknown>;
    protected abstract getSnapPath(profile: OrsCompatibleRoutingProfile): string;
    protected getProviderDisplayName(): string;
}
