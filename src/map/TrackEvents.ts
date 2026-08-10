// DOM event names shared between the chart, the map providers, and the
// playback tool.
//
// These cross plugin bundles: the name is the entire contract - a typo in
// one bundle is a listener that never fires. Import the constant, never
// re-spell the name.
//
// `PLAYBACK_POSITION` doubles as a CSS class name in places-utilities
// (`.places-track-playback-position` styles the playback marker). The two are
// unrelated despite the shared spelling - do not "unify" them.

// Chart -> playback: the cursor is hovering this track point.
export const TRACK_POINT_HOVER_EVENT = 'places-track-point-hover';

// Chart -> map: the user clicked this track point; show it.
export const TRACK_POINT_SELECT_EVENT = 'places-track-point-select';

// Playback -> chart/map: the playhead moved to this position.
export const TRACK_PLAYBACK_POSITION_EVENT = 'places-track-playback-position';

// Block -> playback: asking the playback tool to move to a position.
export const TRACK_POSITION_REQUEST_EVENT = 'places-track-position-request';

// Block -> map: asking the map to inspect (and reveal) a track point.
export const TRACK_INSPECTION_REQUEST_EVENT = 'places-track-inspection-request';
