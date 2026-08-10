import type * as GeoJSON from 'geojson';
import type { Coordinate } from '../geo/DistanceCalculator';
import type { CachePolicy } from '../settings/CachePolicy';
import type { ZoomRange } from '../ZoomVisibility';

export type RouteTravelMode = 'drive' | 'walk' | 'bike';
export type IsochroneRangeType = 'time' | 'distance';
export type RouteMetricLabels = 'total' | 'legs' | 'both' | 'none';

export interface RouteWaypoint extends Coordinate {
  name?: string;
  sourcePath?: string;
  icon?: string;
}

export interface RouteOverlayRequestBase {
  name?: string;
  // How long a cached overlay stays usable. Default: the shared policy (cache, never expiring from age).
  cache?: CachePolicy;
  // Route service to use for this group; falls back to the block routeProvider, then the map provider, then the first available service.
  provider?: string;
  mode: RouteTravelMode;
  // Account for traffic on driving requests. Honored when the provider's
  // capabilities report the matching flag (`trafficDirections` /
  // `trafficIsochrones`): Mapbox and Geoapify. Ignored by the rest and for
  // non-driving modes. Traffic requests bypass the overlay cache - the data
  // is time-sensitive.
  traffic?: boolean;
}

export interface DirectionsOverlayRequest extends RouteOverlayRequestBase {
  routes: RouteWaypoint[][];
  optimize?: boolean;
  // Which generated metric labels to show on the route. Defaults to total.
  metricLabels?: RouteMetricLabels;
  labelTemplate?: string;
  legLabelTemplate?: string;
  // Template for the marker labels at each route waypoint (start / stop N / end). Resolved against a
  // per-endpoint context: `{this.name}`, `{this.index}`, `{this.role}`, `{this.role_label}`,
  // `{this.icon}`, `{this.path}`. Empty hides the labels. Default `{this.role_label}: {this.name}`.
  // The generator resolves the block > global cascade before setting it.
  waypointLabelTemplate?: string;
  style?: DirectionsOverlayStyle;
}

export interface DirectionsOverlayStyle {
  color?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
}

export interface IsochroneOverlayStyle {
  colors?: string[];
  strokeWidth?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
}

export interface IsochroneOverlayRequest extends RouteOverlayRequestBase {
  rangeType: IsochroneRangeType;
  ranges: number[];
  centers: RouteWaypoint[];
  polygons: boolean;
  // Render-only zoom visibility for the generated overlay. Does not affect provider geometry requests.
  zoom?: ZoomRange;
  style?: IsochroneOverlayStyle;
}

export interface RouteOverlayCapabilities {
  // False for providers that only offer directions (e.g. Radar). Default true.
  supportsIsochrones?: boolean;
  routeOptimization: boolean;
  distanceIsochrones: boolean;
  polygonIsochrones: boolean;
  // Honors `traffic: true` on driving isochrones. Default false.
  trafficIsochrones?: boolean;
  // Honors `traffic: true` on driving directions. Default false.
  trafficDirections?: boolean;
}

export interface RouteOverlayService {
  getProviderName(): string;
  getCapabilities?(): RouteOverlayCapabilities;
  getDirectionsOverlay(request: DirectionsOverlayRequest): Promise<GeoJSON.FeatureCollection>;
  getIsochroneOverlay(request: IsochroneOverlayRequest): Promise<GeoJSON.FeatureCollection>;
}
