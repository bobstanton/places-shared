import type { NestedKeyDefinition, ParameterDefinition } from '../services/CodeBlockDefinitionTypes';
import { CACHE_PARAMETER_DESCRIPTION, CACHE_PARAMETER_VALUES } from './CachePolicy';

export const COMMON_SIZE_PARAMS: ParameterDefinition[] = [
  { name: "height", values: "**calc(100vh - 200px)**, 400px, 50vh, 600px" },
  { name: "width", description: "Includes the legend and info; percentages measure note width, vw measures window width", values: "**100%**, 800px, 90vw" }
];

export const COMMON_DATE_PARAMS: ParameterDefinition[] = [
  { name: "startDate", values: "**today**, 2024-01-01, yesterday, +1d" },
  { name: "endDate", values: "**+7d**, 2024-01-07, tomorrow, +2w" }
];

export const COMMON_UNIT_PARAM: ParameterDefinition =
  { name: "units", values: "**imperial**, metric" };

// Every block's `cache:` key documents the shared grammar (see CachePolicy).
export const COMMON_CACHE_PARAM: ParameterDefinition =
  { name: "cache", description: CACHE_PARAMETER_DESCRIPTION, values: CACHE_PARAMETER_VALUES };

export const COMMON_LOCATION_PARAM: ParameterDefinition =
  { name: "location", values: "41.408,-75.662 or note's Location property" };

export const COMMON_COORDINATES_PARAM: ParameterDefinition =
  { name: "coordinates", description: "Coordinates (supports multiple separated by ;)", values: "41.408,-75.662" };

export const COMMON_SIZE_KEYS = ['height', 'width'];

export const COMMON_DATE_KEYS = ['startDate', 'endDate'];

export const BOOLEAN_VALUES = ['true', 'false'];

export const UNIT_VALUES = ['metric', 'imperial'];

export const QUERY_PARAMETER_NESTED_KEYS: NestedKeyDefinition[] = [
  { name: "name", description: "Parameter name, referenced as {parameter.name} in the query or any other setting" },
  { name: "type" },
  { name: "control", description: "Input control; inferred from type when omitted" },
  { name: "label", description: "Display label; defaults to the parameter name" },
  { name: "default", description: "Initial value. On a list parameter, `all` selects every option, including options an optionsQuery resolves later" },
  { name: "min", description: "Minimum for numeric parameters" },
  { name: "max", description: "Maximum for numeric parameters" },
  { name: "step" },
  { name: "scale", description: "control: range only. log spaces values by ratio, giving values near min most of the slider; linear is the default" },
  { name: "showValue", description: "control: range only. false hides the min-max readout beside the slider" },
  { name: "width", description: "Fixed lengths size the input; percentages size the parameter relative to the control strip" },
  { name: "options", description: "Allowed values for enum/list parameters; suggestions for combobox" },
  { name: "optionsQuery", description: "First SQL column supplies choices or numeric range limits; may reference earlier parameters" },
  { name: "range", description: "Shorthand for min, max" },
  { name: "play", description: "Auto-advance interval: true (1000 ms) or milliseconds. Sliders step and wrap; dropdown and segmented controls cycle their options" },
  { name: "showOnMap", description: "Show the current location, or each stops entry, as a map marker" },
  { name: "icon", description: "Marker icon used for every value when showOnMap is enabled; declaring it enables map markers" },
  { name: "icons", description: "Positional marker icons for a stops list; declaring the list enables map markers", apply: "icons:\n  - " },
  { name: "render", description: "control: custom only. JavaScript returning HTML for the control", apply: "render: |\n  return " },
  { name: "mount", description: "control: custom only. JavaScript run after each render; may return a cleanup function", apply: "mount: |\n  " },
];

const HEATMAP_COLOR_DETAILS: Record<string, string> = {
  plasma: 'Dark blue through purple and orange to bright yellow',
  viridis: 'Dark purple through blue and green to yellow',
  inferno: 'Near-black through purple and red to pale yellow',
  magma: 'Near-black through purple and pink to pale cream',
  pastel: 'Purple, cyan, green, yellow, pink',
  soft: 'Alias for pastel',
  'yellow-to-red': 'Pale yellow through orange to dark red',
  blues: 'Light to dark blue',
  heat: 'Blue through a pale center to red',
  traffic: 'Green through yellow and orange to red',
};

export const VALUE_DETAILS: Record<string, Record<string, string>> = {
  cellSelection: {
    land: "Prefer a land grid cell",
    sea: 'Prefer a sea grid cell',
    nearest: 'Use the nearest grid cell, land or sea',
  },
  chartType: {
    elevation: 'Elevation against distance',
    'elevation-grade': 'Elevation against distance, colored by grade',
    'elevation-time': 'Elevation against elapsed time',
    speed: 'Speed against distance',
    'speed-time': 'Speed against elapsed time',
    pace: 'Pace against distance',
    'pace-time': 'Pace against elapsed time',
    grade: 'Grade against distance',
  },
  colorBy: {
    none: 'Single flat color',
    elevation: 'Color by absolute elevation',
    grade: 'Color by steepness',
  },
  clusterStyle: {
    circles: 'One circle per cluster, labeled with how many markers it holds',
    heatmap: 'Shaded density over the same points',
  },
  iconImageDetail: {
    standard: "1x image pixel ratio",
    sharp: "2x image pixel ratio",
    maximum: "3x image pixel ratio",
  },
  colorScheme: HEATMAP_COLOR_DETAILS,
  heatmapColorScheme: HEATMAP_COLOR_DETAILS,
  shapeMatch: {
    edge_walk: "Match a trace that already follows the road network",
    map_snap: "Snap a trace onto the road network",
    walk_or_snap: 'Walks the edges first, snapping only where that fails',
  },
  costing: {
    pedestrian: 'Match against footpaths and pavements',
    bicycle: 'Match against cycleways and roads open to bikes',
    auto: 'Match against the drivable road network',
  },
  datum: {
    mllw: 'Mean lower low water - the NOAA chart datum',
    navd88: 'North American Vertical Datum of 1988',
    stnd: "Station datum - the gauge's own zero",
  },
  defaultVisibility: {
    hidden: 'Tracks stay hidden until a marker is clicked',
    visible: 'Draw every track on load',
  },
  details: {
    popup: 'Show clicked-point details in a map popup',
    panel: 'Show clicked-point details in a panel beside the map',
  },
  layout: {
    rows: 'One stacked section per day',
    continuous: 'One chart flowing left to right across the range',
  },
  legend: {
    hidden: 'No legend',
    top: 'Legend above the block',
    bottom: 'Legend below the block',
  },
  lineStyle: {
    solid: 'Unbroken line',
  },
  markerRenderer: {
    native: "MapLibre symbol layers",
    html: 'HTML markers - styleable with arbitrary CSS',
  },
  matchProvider: {
    stadia: 'Stadia Maps map matching - uses the configured Stadia key',
  },
  method: {
    standard: "Default shading algorithm",
    combined: 'Blends slope and aspect',
    igor: 'Soft, low-contrast shading in the Igor style',
    multidirectional: 'Light from several directions',
  },
  mode: {
    current: 'Conditions right now',
    minutely15: '15-minute resolution',
    hourly: 'Hour-by-hour rows',
    daily: 'One row per day',
    h: 'Alias for hourly',
    d: 'Alias for daily',
    '15m': 'Alias for minutely15',
    '15min': 'Alias for minutely15',
  },
  strategy: {
    'density-cloud': 'Shade a grid by how many tracks pass through each cell',
    'track-corridor': 'Thicken and color shared corridors along the tracks',
    'opacity-stacking': 'Overdraw every track; repeated routes darken',
  },
  units: {
    metric: 'Kilometers, meters, km/h, Celsius',
    imperial: 'Miles, feet, mph, Fahrenheit',
  },
  visibility: {
    all: "Show start, midpoint, and end labels",
    none: 'No labels',
    start: 'Label the start only',
    mid: 'Alias for midpoint',
    midpoint: 'Label the midpoint only',
    end: 'Label the end only',
  },
};

VALUE_DETAILS.control = {
  range: 'Two handles selecting a low and high bound',
  number: 'Numeric text field with steppers',
  combobox: 'Text field with suggestions; any value is allowed',
  segmented: 'Options as a row of buttons',
  date: 'Produces YYYY-MM-DD',
  time: 'Produces HH:MM',
  location: 'Coordinate field with a map picker',
  stops: 'Editable list of ordered rows',
  custom: 'Drawn by the block\'s own JavaScript in render (and optionally mount)',
};

VALUE_DETAILS.queryParametersPosition = {
  above: 'Controls above the block',
  below: 'Controls below the block',
  floating: 'Controls over the block, with a collapse toggle',
};

VALUE_DETAILS.queryParametersLayout = {
  horizontal: 'Controls along a row',
  vertical: 'One control per line',
};

VALUE_DETAILS.scale = {
  linear: 'Equal slider length per step',
  log: 'Equal slider length per tenfold; values near min get most of the slider',
};

VALUE_DETAILS.camera = {
  follow: 'Camera tracks the moving position along the route',
  none: 'Camera stays where the user left it',
};

VALUE_DETAILS.stats = {
  distance: 'Total distance',
  elevation: 'Ascent and descent',
  time: 'Elapsed time',
  speed: 'Average and maximum speed',
  pace: 'Average pace',
  points: 'Number of track points',
};

VALUE_DETAILS.type = {
  enum: 'One value from a fixed list',
  list: 'Several values from a fixed list',
  location: 'Coordinate pair, pickable on a map',
  geodata: 'GeoJSON, GPX, FIT, CSV, or a note holding a track',
  image: 'Georeferenced image overlay',
  'vector-tile': 'An MVT tileset, styled by layerType',
};

VALUE_DETAILS.columns = {
  time: 'Hour of the row',
  weather: 'Condition icon and description',
  high: 'Daily high temperature',
  low: 'Daily low temperature',
  high_low: 'Daily high and low in one column',
  feels_like: "Apparent temperature",
  precip_prob: 'Chance of precipitation, as a percentage',
  precip_amt: 'Precipitation amount',
  precip_type: 'Rain, showers, or snow',
  wind: 'Wind speed',
  wind_gusts: 'Peak gust speed',
  wind_dir: 'Wind direction',
  humidity: 'Relative humidity',
  pressure: 'Air pressure at mean sea level',
  visibility: 'Horizontal visibility',
};

// Position keys share one vocabulary.
const POSITION_DETAILS: Record<string, string> = {
  hidden: 'Do not show it',
  top: 'Show it above the block',
  bottom: 'Show it below the block',
};

VALUE_DETAILS.legendLocation = POSITION_DETAILS;
VALUE_DETAILS.infoLocation = POSITION_DETAILS;

VALUE_DETAILS.debug = {
  true: 'On-map overlay with map state, viewport, and performance',
  false: 'No diagnostics',
  settings: 'Table under the block showing how every setting resolved across defaults, global, provider, and block layers',
  parameters: "Parameter values, substitutions, and marker filter results; adds a popup fields inspector",
};

export function valueDetail(key: string, value: string): string | undefined {
  return VALUE_DETAILS[key]?.[value];
}
