import type * as maplibregl from 'maplibre-gl';
import { type MapPlace } from "../../overlay/index";
import type { MapRenderRequest } from "../../settings/index";
import type { CommonMapSettings } from "../services/index";
import type { ViewportClusteringManager } from "../../map/index";
import type { MapState } from '../../maplibre/MapState';
export declare function updateClusteredMarkers(map: maplibregl.Map, clusteringManager: ViewportClusteringManager<maplibregl.Marker>, mapState: MapState, places: MapPlace[], settings: CommonMapSettings | null, request: MapRenderRequest): void;
