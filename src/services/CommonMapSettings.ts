import type { TrackColorBy, TrackVisibilityResult } from '../track';
import type { MetricWindow, MapRenderRequest, ResolvedMapConfig } from '../settings';
import type { IconImageQuality } from '../map';
import type { MapPlace } from '../place';

export interface CommonMapSettings {
  trackColorBy?: TrackColorBy;
  trackOutline?: boolean;  
  trackGradeWindow: MetricWindow;
  trackSpeedWindow: MetricWindow;
  showLabels: boolean;
  popup?: ResolvedMapConfig['popup'];
  popupSourcePath?: string;
  popupRenderers: MapRenderRequest['runtime']['popupRenderers'];
  trackDefaultVisibility?: 'visible' | 'hidden';
  poiDiscovery?: boolean;  
  iconImageQuality: IconImageQuality;
  onPlaceAction?: (place: MapPlace, actionId: string, state: { checked?: boolean }) => void;
  placeNoteHost?: MapRenderRequest['runtime']['placeNoteHost'];
  reverseGeocodeHost?: MapRenderRequest['runtime']['reverseGeocodeHost'];
  inspectTrack?: MapRenderRequest['runtime']['inspectTrack'];
  trackDetails: ResolvedMapConfig['trackDetails'];
  trackVisibility: TrackVisibilityResult;
  popupDebug?: MapRenderRequest['runtime']['popupDebug'];
}
