import { type Coordinate } from '../geo/DistanceCalculator';
import { type Meters } from '../Units';
import { type ElevationProfile, type IElevationService } from './IElevationService';
import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';
export declare abstract class ElevationServiceBase implements IElevationService {
    protected extensionSettings: IPlaceExtensionSettings;
    protected constructor(extensionSettings: IPlaceExtensionSettings);
    abstract getProviderName(): string;
    getElevationProfile(coordinates: Coordinate[]): Promise<ElevationProfile>;
    protected abstract getElevationForPoints(coordinates: Coordinate[]): Promise<Meters[]>;
    private validateElevationResults;
    protected assertApiKeyConfigured(): void;
    protected getProviderDisplayName(): string;
    static buildElevationProfile(coordinates: Coordinate[], elevations: Meters[]): ElevationProfile;
}
