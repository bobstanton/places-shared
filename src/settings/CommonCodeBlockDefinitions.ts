import { NestedKeyDefinition, ParameterDefinition } from '../services/IPlacePluginExtension';
import { CACHE_PARAMETER_DESCRIPTION, CACHE_PARAMETER_VALUES } from './CachePolicy';

export const COMMON_SIZE_PARAMS: ParameterDefinition[] = [
  { name: "height", values: "**calc(100vh - 200px)**, 400px, 50vh, 600px" },
  { name: "width", values: "**100%**, 800px, 90vw" }
];

export const COMMON_DATE_PARAMS: ParameterDefinition[] = [
  { name: "startDate", description: "Start date", values: "**today**, 2024-01-01, yesterday, +1d" },
  { name: "endDate", description: "End date", values: "**+7d**, 2024-01-07, tomorrow, +2w" }
];

export const COMMON_UNIT_PARAM: ParameterDefinition =
  { name: "units", description: "Unit system", values: "**imperial**, metric" };

// Every block's `cache:` key documents the shared grammar (see CachePolicy).
export const COMMON_CACHE_PARAM: ParameterDefinition =
  { name: "cache", description: CACHE_PARAMETER_DESCRIPTION, values: CACHE_PARAMETER_VALUES };

export const COMMON_LOCATION_PARAM: ParameterDefinition =
  { name: "location", description: "Coordinates", values: "40.748,-73.985 or note's Location property" };

export const COMMON_COORDINATES_PARAM: ParameterDefinition =
  { name: "coordinates", description: "Coordinates (supports multiple separated by ;)", values: "37.7749,-122.4194" };

export const COMMON_SIZE_KEYS = ['height', 'width'];

export const COMMON_DATE_KEYS = ['startDate', 'endDate'];

export const BOOLEAN_VALUES = ['true', 'false'];

export const UNIT_VALUES = ['metric', 'imperial'];

// The `queryParameters:` sub-keys, shared by every block that accepts an
// interactive parameter strip.
export const QUERY_PARAMETER_NESTED_KEYS: NestedKeyDefinition[] = [
  { name: "name", description: "Parameter name, referenced as {parameter.name} in the query or any other setting" },
  { name: "type", description: "Value type: int, float, string, date, datetime, time, boolean, enum, list, or location" },
  { name: "control", description: "Input control; inferred from type when omitted" },
  { name: "label", description: "Display label; defaults to the parameter name" },
  { name: "default", description: "Initial value. On a list parameter, `all` selects every option, including options an optionsQuery resolves later" },
  { name: "min", description: "Minimum for numeric parameters" },
  { name: "max", description: "Maximum for numeric parameters" },
  { name: "step", description: "Slider/number step size" },
  { name: "width", description: "Control width. Fixed lengths size the input; percentages size the parameter relative to the full control strip, e.g. 240px, 18rem, 30ch, or 50%" },
  { name: "options", description: "Allowed values for enum/list parameters; suggestions for combobox" },
  { name: "optionsQuery", description: "VaultQuery SQL whose first column supplies the options. May reference parameters declared earlier as {parameter.*} (cascading dropdowns)" },
  { name: "range", description: "Shorthand for min, max" },
  { name: "play", description: "Auto-advance interval: true (1000 ms) or milliseconds. Sliders step and wrap; dropdown and segmented controls cycle their options" },
  { name: "render", description: "control: custom only. JavaScript returning the control's HTML. Receives (value, options, param, h); mark an element data-places-value to set that value on click, or a field data-places-input to report its own", apply: "render: |\n  return " },
  { name: "mount", description: "control: custom only. Optional JavaScript run after each render for behaviour markup cannot express. Receives (el, value, options, param, h); call param.setValue() and return a cleanup function", apply: "mount: |\n  " },
];

// Per-value explanations for keys whose values are a closed set of named
// choices, shared by the code block autocomplete and the VaultQuery
// definition-block providers. Boolean keys and example-style values (dates,
// times, titles, sizes) are deliberately absent.
export const VALUE_DETAILS: Record<string, Record<string, string>> = {
  cellSelection: {
    land: 'Prefer a land grid cell - more accurate on coastlines',
    sea: 'Prefer a sea grid cell',
    nearest: 'Use the nearest grid cell, land or sea',
  },
  chartType: {
    elevation: 'Elevation against distance',
    'elevation-grade': 'Elevation against distance, coloured by grade',
    'elevation-time': 'Elevation against elapsed time',
    speed: 'Speed against distance',
    'speed-time': 'Speed against elapsed time',
    pace: 'Pace against distance',
    'pace-time': 'Pace against elapsed time',
    grade: 'Grade against distance',
  },
  colorBy: {
    none: 'Single flat colour',
    elevation: 'Colour by absolute elevation',
    grade: 'Colour by steepness',
    speed: 'Colour by speed',
    pace: 'Colour by pace',
  },
  colorScheme: {
    'yellow-to-red': 'Yellow through red, rising with frequency',
    blues: 'Light to dark blue',
    heat: 'Classic heat gradient',
    traffic: 'Green, amber, red',
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
  layerType: {
    line: 'Draw features as lines',
    fill: 'Draw polygons as filled areas',
    circle: 'Draw points as circles',
    symbol: 'Draw points as icons and text labels',
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
    native: 'GL symbol layers - faster, scales to many markers',
    html: 'HTML markers - styleable with arbitrary CSS',
  },
  matchProvider: {
    valhalla: 'Public Valhalla instance - no key required',
    stadia: 'Stadia Maps map matching - uses the configured Stadia key',
  },
  method: {
    standard: 'Balanced shading, the usual choice',
    basic: 'Cheapest shading, fewest artefacts on flat terrain',
    combined: 'Blends slope and aspect for stronger relief',
    igor: 'Soft, low-contrast shading in the Igor style',
    multidirectional: 'Light from several directions; reveals detail in shadow',
  },
  mode: {
    drive: 'Travel by car',
    walk: 'Travel on foot',
    bike: 'Travel by bicycle',
    current: 'Conditions right now',
    minutely15: '15-minute resolution',
    hourly: 'Hour-by-hour rows',
    daily: 'One row per day',
  },
  strategy: {
    'density-cloud': 'Shade a grid by how many tracks pass through each cell',
    'track-corridor': 'Thicken and colour shared corridors along the tracks',
    'opacity-stacking': 'Overdraw every track; repeated routes darken',
  },
  units: {
    metric: 'Kilometres, metres, km/h, Celsius',
    imperial: 'Miles, feet, mph, Fahrenheit',
  },
  visibility: {
    all: 'Label every point',
    none: 'No labels',
    start: 'Label the start only',
    mid: 'Label the midpoint only',
    end: 'Label the end only',
  },
};

VALUE_DETAILS.control = {
  slider: 'Drag along a numeric range',
  range: 'Two handles selecting a low and high bound',
  number: 'Numeric text field with steppers',
  text: 'Free text field',
  combobox: 'Text field with suggestions; any value is allowed',
  dropdown: 'Pick one option from a list',
  segmented: 'Options as a row of buttons',
  toggle: 'On/off switch',
  date: 'Produces YYYY-MM-DD',
  datetime: 'Date and time picker',
  time: 'Produces HH:MM',
  multiselect: 'Pick several options',
  location: 'Coordinate field with a map picker',
  stops: 'Editable list of ordered rows',
  custom: 'Drawn by the block\'s own JavaScript in render (and optionally mount)',
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

// `type` is shared: query parameter value types and overlay entry kinds. The
// completion scopes which set it offers by the enclosing block.
VALUE_DETAILS.type = {
  int: 'Whole number',
  float: 'Decimal number',
  string: 'Free text',
  boolean: 'True or false',
  enum: 'One value from a fixed list',
  list: 'Several values from a fixed list',
  date: 'Calendar date',
  datetime: 'Date and time',
  time: 'Time of day',
  location: 'Coordinate pair, pickable on a map',
  geodata: 'GeoJSON, GPX, CSV, or a note holding a track',
  image: 'Georeferenced image overlay',
  'vector-tile': 'An MVT tileset, styled by layerType',
};

VALUE_DETAILS.columns = {
  time: 'Hour of the row',
  date: 'Calendar date of the row',
  weather: 'Condition icon and description',
  temp: 'Temperature',
  high: 'Daily high temperature',
  low: 'Daily low temperature',
  high_low: 'Daily high and low in one column',
  feels_like: 'Apparent temperature, accounting for wind and humidity',
  precip_prob: 'Chance of precipitation, as a percentage',
  precip_amt: 'Precipitation amount',
  precip_type: 'Rain, showers, or snow',
  wind: 'Wind speed',
  wind_gusts: 'Peak gust speed',
  wind_dir: 'Wind direction',
  humidity: 'Relative humidity',
  cloud: 'Cloud cover',
  pressure: 'Air pressure at mean sea level',
  visibility: 'Horizontal visibility',
  dew_point: 'Dew point temperature',
  sunrise: 'Sunrise time',
  sunset: 'Sunset time',
  uv: 'UV index',
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
  parameters: 'Table under the block showing parameter values, {parameter.*} substitutions, and per-rule markerFilter results; marker popups gain a fields-and-filters inspector',
};

export function valueDetail(key: string, value: string): string | undefined {
  return VALUE_DETAILS[key]?.[value];
}
