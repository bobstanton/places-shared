import type { MapRenderPlan } from '../render';
import type { MapConfigPatch, ResolvedMapConfig, ConfigWarning } from '../settings';
export interface MapHostServices {
    maps: {
        resolveMapProvider(explicitProvider?: string): string;
        getMapProviderDefaults?(providerName: string): MapConfigPatch;
        resolveMapConfig?(request: {
            providerName: string;
            blockSettings: Readonly<Record<string, unknown>>;
            placeCount: number;
            warnings?: ConfigWarning[];
        }): {
            config: ResolvedMapConfig;
            clusteringEnabled: boolean;
        };
        renderMapSurface(request: PortableMapSurfaceRequest): Promise<PortableMapSurfaceHandle | null>;
        disposeMapSurfaces(element: HTMLElement): void;
    };
}
export interface PortableMapSurfaceRequest {
    host: HTMLElement;
    mapContainer?: HTMLElement;
    mapContainerClass?: string;
    height?: string;
    providerName: string;
    ctx?: {
        sourcePath: string;
    };
    renderPlan: MapRenderPlan;
    isStale?: () => boolean;
    onRerenderRequested?: (reason: string) => Promise<void>;
}
export interface PortableMapSurfaceHandle {
    readonly mapContainer: HTMLElement;
    update(plan: MapRenderPlan): Promise<boolean>;
    dispose(): void;
}
