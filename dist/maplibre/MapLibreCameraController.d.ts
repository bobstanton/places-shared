import type * as maplibregl from 'maplibre-gl';
import type { MapRenderRequest } from "../settings/index";
import type { MapCameraApplyResult } from "../services/index";
import { type MapCameraIntent } from "../render/index";
export declare function withProgrammaticCamera(map: maplibregl.Map, move: () => void): void;
export declare function applyCameraIntent(map: maplibregl.Map, camera: MapCameraIntent, request: MapRenderRequest): MapCameraApplyResult;
