import { type Coordinate } from '../geo/index';
import { type Meters } from '../units/index';
import { type ElevationProfile, type IElevationService } from './index';
import type { IPlaceExtensionSettings } from '../settings/index';
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
