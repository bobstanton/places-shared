import type { MapSourceContext } from '../settings/MapConfiguration';
import { sharedRegistryMap } from '../utils/CrossBundleRegistry';
import type { TrackData } from '../geo/TrackTypes';

export type TrackBuilderCoordinate = readonly [longitude: number, latitude: number];
export interface TrackBuilderLinePosition { readonly segmentIndex: number; readonly t: number; }
export interface TrackBuilderSectionEndpoint { readonly sectionId: string; readonly endpoint: 'start' | 'end'; }
export interface TrackBuilderPointMetadata {
  readonly elevationMeters?: number;
  readonly time?: string;
  readonly gpxInnerXml?: string;
}

export interface TrackBuilderSection {
  readonly id: string;
  readonly coordinates: readonly TrackBuilderCoordinate[];
  readonly layerId: string;
  readonly sourceLayer?: string;
  readonly featureId?: string | number;
  readonly sourceFeatureKey?: string;
  readonly name?: string;
  readonly sourceProperties?: Readonly<Record<string, unknown>>;
  readonly sourceCoordinates?: readonly TrackBuilderCoordinate[];
  readonly pointMetadata?: readonly (TrackBuilderPointMetadata | undefined)[];
  readonly sourcePointMetadata?: readonly (TrackBuilderPointMetadata | undefined)[];
  readonly startPosition?: TrackBuilderLinePosition;
  readonly endPosition?: TrackBuilderLinePosition;
  readonly startCoordinateOverride?: TrackBuilderCoordinate;
  readonly endCoordinateOverride?: TrackBuilderCoordinate;
  readonly breakBefore?: boolean;
}

export interface TrackBuilderWaypoint {
  readonly id: string;
  readonly coordinate: TrackBuilderCoordinate;
  readonly name?: string;
  readonly symbol?: string;
  readonly description?: string;
  readonly gpxInnerXml?: string;
}

export interface TrackBuilderDraft {
  readonly sections: readonly TrackBuilderSection[];
  readonly waypoints?: readonly TrackBuilderWaypoint[];
}

export interface TrackBuilderHistory {
  readonly draft: TrackBuilderDraft;
  readonly undo: readonly TrackBuilderDraft[];
  readonly redo: readonly TrackBuilderDraft[];
}

export interface ParsedTrackBuilderGpx {
  readonly name?: string;
  readonly sections: readonly TrackBuilderSection[];
  readonly waypoints: readonly TrackBuilderWaypoint[];
}

export function trackDataToTrackBuilderSections(track: TrackData): readonly TrackBuilderSection[] {
  const paths = track.segments?.length ? track.segments : [track.points];
  const sections = paths.map((points, index): TrackBuilderSection | undefined => {
    const coordinates: TrackBuilderCoordinate[] = points
      .filter(point => Number.isFinite(point.longitude) && Number.isFinite(point.latitude))
      .map(point => [point.longitude, point.latitude]);
    const pointMetadata = points
      .filter(point => Number.isFinite(point.longitude) && Number.isFinite(point.latitude))
      .map(point => point.elevationMeters !== undefined || point.time
        ? { elevationMeters: point.elevationMeters, time: point.time?.toISOString() }
        : undefined);
    if (coordinates.length < 2) return undefined;
    return {
      id: `track-import:${index}`,
      sourceFeatureKey: `track-import:${index}`,
      layerId: 'track-import',
      name: track.metadata.name,
      coordinates,
      sourceCoordinates: coordinates,
      pointMetadata,
      sourcePointMetadata: pointMetadata,
      startPosition: { segmentIndex: 0, t: 0 },
      endPosition: { segmentIndex: coordinates.length - 2, t: 1 },
      breakBefore: index > 0,
    };
  }).filter((section): section is TrackBuilderSection => section !== undefined);

  return sections;
}

const DEFAULT_JOIN_TOLERANCE_METERS = 5;

const REGISTRY_KEY = Symbol.for('places.map.track-builder-drafts');
const EMPTY_DRAFT: TrackBuilderDraft = Object.freeze({ sections: Object.freeze([]), waypoints: Object.freeze([]) });

type DraftRegistry = Map<string, TrackBuilderHistory>;

export function trackBuilderDraftKey(source: MapSourceContext, id?: string): string {
  const path = source.path ?? '';
  const block = source.lineStart ?? 0;
  return id ? `${path}:${block}:track-builder:${id}` : `${path}:${block}`;
}

export function getTrackBuilderHistory(key: string): TrackBuilderHistory {
  const registry = getRegistry();
  const existing = registry.get(key);
  if (existing) return existing;
  const created = Object.freeze({ draft: EMPTY_DRAFT, undo: Object.freeze([]), redo: Object.freeze([]) });
  registry.set(key, created);
  return created;
}

export function appendTrackBuilderSection(key: string, section: TrackBuilderSection): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const previousSection = current.draft.sections[current.draft.sections.length - 1];
  const previousEnd = previousSection?.coordinates[previousSection.coordinates.length - 1];
  // Explicit endpoint selections are directional: click order must survive even when the
  // new section begins away from the current endpoint. Older whole-feature sections may
  // still be automatically oriented for continuity.
  const directional = Boolean(section.startPosition && section.endPosition);
  const reverse = !directional && shouldReverseCoordinates(section.coordinates, previousEnd);
  const coordinates = reverse ? [...section.coordinates].reverse() : [...section.coordinates];
  const pointMetadata = reverse && section.pointMetadata?.length === section.coordinates.length
    ? [...section.pointMetadata].reverse()
    : section.pointMetadata;
  return commit(key, current, { sections: [...current.draft.sections, { ...section, coordinates, pointMetadata }] });
}

export function prependTrackBuilderSection(key: string, section: TrackBuilderSection): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  return commit(key, current, { sections: [section, ...current.draft.sections] });
}

export function appendTrackBuilderSections(key: string, sections: readonly TrackBuilderSection[]): TrackBuilderHistory {
  if (sections.length === 0) return getTrackBuilderHistory(key);
  const current = getTrackBuilderHistory(key);
  return commit(key, current, { sections: [...current.draft.sections, ...sections] });
}

export function prependTrackBuilderSections(key: string, sections: readonly TrackBuilderSection[]): TrackBuilderHistory {
  if (sections.length === 0) return getTrackBuilderHistory(key);
  const current = getTrackBuilderHistory(key);
  return commit(key, current, { sections: [...sections, ...current.draft.sections] });
}

export function removeLastTrackBuilderSection(key: string): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  if (current.draft.sections.length === 0) return current;
  return commit(key, current, { sections: current.draft.sections.slice(0, -1) });
}

export function removeTrackBuilderSection(key: string, sectionId: string): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const sections = current.draft.sections.filter(section => section.id !== sectionId);
  return sections.length === current.draft.sections.length ? current : commit(key, current, { sections });
}

export function replaceTrackBuilderSection(key: string, section: TrackBuilderSection): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const index = current.draft.sections.findIndex(candidate => candidate.id === section.id);
  if (index < 0) return current;
  const sections = [...current.draft.sections];
  sections[index] = section;
  return commit(key, current, { sections });
}

// One undoable edit.
export function replaceTrackBuilderSections(key: string, sections: readonly TrackBuilderSection[]): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  return commit(key, current, { sections });
}

// One undoable edit.
export function replaceTrackBuilderContent(key: string, sections: readonly TrackBuilderSection[], waypoints: readonly TrackBuilderWaypoint[]): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  return commit(key, current, { sections, waypoints });
}

// Keeps the section's slice of the source geometry.
export function reverseTrackBuilderSection(section: TrackBuilderSection): TrackBuilderSection {
  return {
    ...section,
    coordinates: [...section.coordinates].reverse(),
    pointMetadata: section.pointMetadata?.length === section.coordinates.length
      ? [...section.pointMetadata].reverse()
      : section.pointMetadata,
    startPosition: section.endPosition,
    endPosition: section.startPosition,
    startCoordinateOverride: section.endCoordinateOverride,
    endCoordinateOverride: section.startCoordinateOverride,
  };
}

// Index range of one connected run of sections.
export interface TrackBuilderPiece {
  readonly startIndex: number;
  endIndex: number;
}

// The connected runs within the draft, in list order. A piece is what becomes
// one GPX track segment, and this shares its continuation rule with
// `trackBuilderSegments` - the two must never disagree about where a break is.
export function trackBuilderPieces(
  sections: readonly TrackBuilderSection[],
  joinToleranceMeters = DEFAULT_JOIN_TOLERANCE_METERS,
): TrackBuilderPiece[] {
  const pieces: TrackBuilderPiece[] = [];
  sections.forEach((section, index) => {
    const previous = index > 0 ? sections[index - 1] : undefined;
    const previousEnd = previous?.coordinates[previous.coordinates.length - 1];
    const current = pieces[pieces.length - 1];
    if (current && continuesPreviousSection(previousEnd, section, joinToleranceMeters)) current.endIndex = index;
    else pieces.push({ startIndex: index, endIndex: index });
  });
  return pieces;
}

function reversePiece(sections: readonly TrackBuilderSection[]): TrackBuilderSection[] {
  return [...sections].reverse().map(reverseTrackBuilderSection);
}

// Reversing recorded points would run their timestamps backwards.
function pieceCarriesTimes(sections: readonly TrackBuilderSection[]): boolean {
  return sections.some(section => section.pointMetadata?.some(point => point?.time));
}

// Merge the two pieces an endpoint join connects, reordering and reversing until
// the joined ends meet. Returns undefined when the endpoints are not the outer
// ends of two different pieces - closing a loop within one piece, or joining an
// interior dead end, is left to the caller's simple splice.
function joinTrackBuilderPieces(
  sections: readonly TrackBuilderSection[],
  connector: TrackBuilderSection,
  anchor: TrackBuilderSectionEndpoint,
  destination: TrackBuilderSectionEndpoint,
  anchorIndex: number,
  destinationIndex: number,
): TrackBuilderSection[] | undefined {
  const pieces = trackBuilderPieces(sections);
  const pieceAt = (index: number) => pieces.find(piece => index >= piece.startIndex && index <= piece.endIndex);
  const anchorPiece = pieceAt(anchorIndex);
  const destinationPiece = pieceAt(destinationIndex);
  if (!anchorPiece || !destinationPiece || anchorPiece === destinationPiece) return undefined;

  const anchorAtTail = anchorIndex === anchorPiece.endIndex && anchor.endpoint === 'end';
  const anchorAtHead = anchorIndex === anchorPiece.startIndex && anchor.endpoint === 'start';
  const destinationAtHead = destinationIndex === destinationPiece.startIndex && destination.endpoint === 'start';
  const destinationAtTail = destinationIndex === destinationPiece.endIndex && destination.endpoint === 'end';
  if (!(anchorAtTail || anchorAtHead) || !(destinationAtHead || destinationAtTail)) return undefined;

  const slice = (piece: TrackBuilderPiece) => sections.slice(piece.startIndex, piece.endIndex + 1);
  const anchorSections = slice(anchorPiece);
  const destinationSections = slice(destinationPiece);
  const anchorTimed = pieceCarriesTimes(anchorSections);
  const destinationTimed = pieceCarriesTimes(destinationSections);

  // The merged run can be travelled either way round. Both are valid GPX: pick
  // the direction that reverses the fewest recorded pieces.
  const cost = (alreadyFacing: boolean, timed: boolean) => (alreadyFacing ? 0 : timed ? 2 : 1);
  const anchorLeads = cost(anchorAtTail, anchorTimed) + cost(destinationAtHead, destinationTimed)
    <= cost(destinationAtTail, destinationTimed) + cost(anchorAtHead, anchorTimed);

  const lead = anchorLeads
    ? (anchorAtTail ? anchorSections : reversePiece(anchorSections))
    : (destinationAtTail ? destinationSections : reversePiece(destinationSections));
  const trail = anchorLeads
    ? (destinationAtHead ? destinationSections : reversePiece(destinationSections))
    : (anchorAtHead ? anchorSections : reversePiece(anchorSections));
  // The caller orients the connector against whichever endpoint was clicked
  // first; point it at the arrangement actually chosen rather than assuming.
  const leadTail = lead[lead.length - 1].coordinates;
  const leadEnd = leadTail[leadTail.length - 1];
  const connectorEnd = connector.coordinates[connector.coordinates.length - 1];
  const link = distanceMeters(leadEnd, connector.coordinates[0]) <= distanceMeters(leadEnd, connectorEnd)
    ? connector
    : reverseTrackBuilderSection(connector);
  const merged = [
    ...lead,
    { ...link, breakBefore: false },
    ...trail.map((section, index) => (index === 0 ? { ...section, breakBefore: false } : section)),
  ];

  // Removing a piece from the middle can leave two unrelated pieces adjacent,
  // and every surviving boundary is restated rather than left to geometry.
  const leadPiece = anchorLeads ? anchorPiece : destinationPiece;
  const runs: TrackBuilderSection[][] = [];
  for (const piece of pieces) {
    if (piece === leadPiece) runs.push(merged);
    else if (piece !== anchorPiece && piece !== destinationPiece) runs.push(slice(piece));
  }
  return runs.flatMap((run, runIndex) => run.map((section, index) =>
    (index === 0 && runIndex > 0 ? { ...section, breakBefore: true } : section)));
}

// Insert a synthetic connector beside an existing endpoint as one undoable edit.
export function insertDirectTrackBuilderSection(
  key: string,
  section: TrackBuilderSection,
  anchor?: TrackBuilderSectionEndpoint,
  destination?: TrackBuilderSectionEndpoint,
): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  if (!anchor) return commit(key, current, { sections: [...current.draft.sections, section] });
  const anchorIndex = current.draft.sections.findIndex(candidate => candidate.id === anchor.sectionId);
  if (anchorIndex < 0) return current;

  const destinationSectionIndex = destination
    ? current.draft.sections.findIndex(candidate => candidate.id === destination.sectionId)
    : -1;
  if (destination && destinationSectionIndex >= 0) {
    const joined = joinTrackBuilderPieces(current.draft.sections, section, anchor, destination, anchorIndex, destinationSectionIndex);
    if (joined) return commit(key, current, { sections: joined });
  }

  const sections = [...current.draft.sections];
  const destinationIndex = destination
    ? sections.findIndex(candidate => candidate.id === destination.sectionId)
    : -1;
  if (anchor.endpoint === 'end') {
    const joinsNext = destination?.endpoint === 'start' && destinationIndex === anchorIndex + 1;
    if (joinsNext) sections[destinationIndex] = { ...sections[destinationIndex], breakBefore: false };
    sections.splice(anchorIndex + 1, 0, { ...section, breakBefore: false });
  } else {
    const joinsPrevious = destination?.endpoint === 'end' && destinationIndex === anchorIndex - 1;
    const priorBreak = sections[anchorIndex].breakBefore;
    sections[anchorIndex] = { ...sections[anchorIndex], breakBefore: false };
    sections.splice(anchorIndex, 0, { ...section, breakBefore: joinsPrevious ? false : priorBreak });
  }
  return commit(key, current, { sections });
}

export function clearTrackBuilderDraft(key: string): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const empty = current.draft.sections.length === 0 && (current.draft.waypoints?.length ?? 0) === 0;
  return empty ? current : commit(key, current, EMPTY_DRAFT);
}

export function trackBuilderWaypoints(draft: TrackBuilderDraft): readonly TrackBuilderWaypoint[] {
  return draft.waypoints ?? [];
}

export function addTrackBuilderWaypoint(key: string, waypoint: TrackBuilderWaypoint): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  return commit(key, current, { sections: current.draft.sections, waypoints: [...trackBuilderWaypoints(current.draft), waypoint] });
}

// One undoable edit.
export function updateTrackBuilderWaypoint(key: string, waypoint: TrackBuilderWaypoint): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const waypoints = trackBuilderWaypoints(current.draft);
  const index = waypoints.findIndex(candidate => candidate.id === waypoint.id);
  if (index < 0) return current;
  const next = [...waypoints];
  next[index] = waypoint;
  return commit(key, current, { sections: current.draft.sections, waypoints: next });
}

export function removeTrackBuilderWaypoint(key: string, waypointId: string): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const waypoints = trackBuilderWaypoints(current.draft);
  const next = waypoints.filter(candidate => candidate.id !== waypointId);
  return next.length === waypoints.length ? current : commit(key, current, { sections: current.draft.sections, waypoints: next });
}

export function undoTrackBuilderEdit(key: string): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const draft = current.undo[current.undo.length - 1];
  if (!draft) return current;
  const next = Object.freeze({ draft, undo: Object.freeze(current.undo.slice(0, -1)), redo: Object.freeze([...current.redo, current.draft]) });
  getRegistry().set(key, next);
  return next;
}

export function redoTrackBuilderEdit(key: string): TrackBuilderHistory {
  const current = getTrackBuilderHistory(key);
  const draft = current.redo[current.redo.length - 1];
  if (!draft) return current;
  const next = Object.freeze({ draft, undo: Object.freeze([...current.undo, current.draft]), redo: Object.freeze(current.redo.slice(0, -1)) });
  getRegistry().set(key, next);
  return next;
}

export function trackBuilderSegments(draft: TrackBuilderDraft, joinToleranceMeters = DEFAULT_JOIN_TOLERANCE_METERS): TrackBuilderCoordinate[][] {
  const segments: TrackBuilderCoordinate[][] = [];
  for (const section of draft.sections) {
    if (section.coordinates.length < 2) continue;
    const current = segments[segments.length - 1];
    if (current && continuesPreviousSection(current[current.length - 1], section, joinToleranceMeters)) {
      current.push(...section.coordinates.slice(1));
    } else {
      segments.push([...section.coordinates]);
    }
  }
  return segments;
}

interface TrackBuilderOutputPoint {
  coordinate: TrackBuilderCoordinate;
  metadata?: TrackBuilderPointMetadata;
}

function trackBuilderPointSegments(draft: TrackBuilderDraft, joinToleranceMeters = DEFAULT_JOIN_TOLERANCE_METERS): TrackBuilderOutputPoint[][] {
  const segments: TrackBuilderOutputPoint[][] = [];
  for (const section of draft.sections) {
    if (section.coordinates.length < 2) continue;
    const metadata = trackBuilderSectionPointMetadata(section);
    const points = section.coordinates.map((coordinate, index) => ({ coordinate, metadata: metadata[index] }));
    const current = segments[segments.length - 1];
    if (current && continuesPreviousSection(current[current.length - 1].coordinate, section, joinToleranceMeters)) {
      current.push(...points.slice(1));
    } else {
      segments.push(points);
    }
  }
  return segments;
}

export function serializeTrackBuilderGpx(draft: TrackBuilderDraft, name: string): string {
  const segments = trackBuilderPointSegments(draft);
  const body = segments.map(segment => `    <trkseg>\n${segment.map(point => serializeGpxPoint(point)).join('\n')}\n    </trkseg>`).join('\n');
  // GPX 1.1 fixes the child order of <gpx> as metadata, wpt*, rte*, trk*:
  // write waypoints ahead of the track.
  const waypoints = trackBuilderWaypoints(draft).map(waypoint => serializeGpxWaypoint(waypoint)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Places" xmlns="http://www.topografix.com/GPX/1/1">\n${waypoints ? `${waypoints}\n` : ''}  <trk>\n    <name>${escapeXml(name)}</name>\n${body}\n  </trk>\n</gpx>\n`;
}

// Routes (rte) become sections too.
export function parseTrackBuilderGpx(content: string): ParsedTrackBuilderGpx {
  if (!/<(?:[A-Za-z_][\w.-]*:)?gpx\b/i.test(content)) throw new Error('The selected file is not GPX XML.');
  const trackElements = xmlElementBodies(content, 'trk');
  const routeElements = xmlElementBodies(content, 'rte');
  const segments = trackElements.flatMap(track => xmlElementBodies(track, 'trkseg').map(segment => xmlPoints(segment, 'trkpt')));
  segments.push(...routeElements.map(route => xmlPoints(route, 'rtept')));
  const editableSegments = segments.filter(segment => segment.length >= 2);
  const waypoints = xmlWaypoints(content);
  // A waypoint-only GPX is a valid starting point.
  if (editableSegments.length === 0 && waypoints.length === 0) {
    throw new Error('The GPX file has no track or route segment with at least two points, and no waypoints.');
  }

  const name = firstXmlText(xmlElementBodies(content, 'metadata')[0], 'name')
    ?? firstXmlText(trackElements[0], 'name')
    ?? firstXmlText(routeElements[0], 'name');
  const sections = editableSegments.map((points, index): TrackBuilderSection => ({
    id: `gpx-import:${index}`,
    sourceFeatureKey: `gpx-import:${index}`,
    layerId: 'gpx-import',
    coordinates: points.map(point => point.coordinate),
    sourceCoordinates: points.map(point => point.coordinate),
    pointMetadata: points.map(point => point.metadata),
    sourcePointMetadata: points.map(point => point.metadata),
    startPosition: { segmentIndex: 0, t: 0 },
    endPosition: { segmentIndex: points.length - 2, t: 1 },
    breakBefore: index > 0,
  }));
  return { name, sections, waypoints };
}

// GPX `<wpt>` elements, which are direct children of `<gpx>` and independent of
// the track geometry. The full original body is retained for serialization to
// put back everything the builder does not edit.
function xmlWaypoints(content: string): TrackBuilderWaypoint[] {
  const qualifiedName = '(?:[A-Za-z_][\\w.-]*:)?wpt';
  const pattern = new RegExp(`<${qualifiedName}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${qualifiedName}\\s*>)`, 'gi');
  const waypoints: TrackBuilderWaypoint[] = [];
  for (const match of content.matchAll(pattern)) {
    const latitude = xmlNumberAttribute(match[1], 'lat');
    const longitude = xmlNumberAttribute(match[1], 'lon');
    if (latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const innerXml = match[2] ?? '';
    waypoints.push({
      id: `gpx-waypoint:${waypoints.length}`,
      coordinate: [longitude, latitude],
      name: firstXmlText(innerXml, 'name'),
      symbol: firstXmlText(innerXml, 'sym'),
      description: firstXmlText(innerXml, 'desc'),
      gpxInnerXml: innerXml || undefined,
    });
  }
  return waypoints;
}

// Waypoints carried by a loaded track note or file, for the configured-track path.
export function trackDataToTrackBuilderWaypoints(track: TrackData): readonly TrackBuilderWaypoint[] {
  return track.waypoints
    .filter(waypoint => Number.isFinite(waypoint.lon) && Number.isFinite(waypoint.lat))
    .map((waypoint, index): TrackBuilderWaypoint => ({
      id: `track-waypoint:${index}`,
      coordinate: [waypoint.lon, waypoint.lat],
      name: waypoint.name || undefined,
      symbol: waypoint.symbol,
      description: waypoint.description,
    }));
}

// Every mutation funnels through here, and waypoints inherit by default: a
// section edit passes `{ sections }` with no waypoints and keeps the ones the
// draft already has. Only a caller that means to change them (a waypoint
// mutation, or EMPTY_DRAFT clearing everything) passes the field explicitly.
function commit(key: string, current: TrackBuilderHistory, draft: TrackBuilderDraft): TrackBuilderHistory {
  const frozenDraft = Object.freeze({
    sections: Object.freeze([...draft.sections]),
    waypoints: Object.freeze([...(draft.waypoints ?? current.draft.waypoints ?? [])]),
  });
  const next = Object.freeze({ draft: frozenDraft, undo: Object.freeze([...current.undo, current.draft]), redo: Object.freeze([]) });
  getRegistry().set(key, next);
  return next;
}

// Whether a section continues the one before it and belongs to the same GPX
// track segment. `breakBefore` forces a split even where the ends coincide.
function continuesPreviousSection(
  previousEnd: TrackBuilderCoordinate | undefined,
  section: TrackBuilderSection,
  joinToleranceMeters: number,
): boolean {
  if (!previousEnd || section.breakBefore || section.coordinates.length === 0) return false;
  return distanceMeters(previousEnd, section.coordinates[0]) <= joinToleranceMeters;
}

function shouldReverseCoordinates(coordinates: readonly TrackBuilderCoordinate[], previousEnd?: TrackBuilderCoordinate): boolean {
  if (!previousEnd || coordinates.length < 2) return false;
  return distanceMeters(previousEnd, coordinates[0]) > distanceMeters(previousEnd, coordinates[coordinates.length - 1]);
}

function distanceMeters(a: TrackBuilderCoordinate, b: TrackBuilderCoordinate): number {
  const radians = Math.PI / 180;
  const dLat = (b[1] - a[1]) * radians;
  const dLon = (b[0] - a[0]) * radians;
  const lat1 = a[1] * radians;
  const lat2 = b[1] * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function xmlElementBodies(content: string | undefined, localName: string): string[] {
  if (!content) return [];
  const qualifiedName = `(?:[A-Za-z_][\\w.-]*:)?${localName}`;
  const pattern = new RegExp(`<${qualifiedName}\\b[^>]*>([\\s\\S]*?)<\\/${qualifiedName}\\s*>`, 'gi');
  return Array.from(content.matchAll(pattern), match => match[1]);
}

function xmlPoints(content: string, localName: 'trkpt' | 'rtept'): TrackBuilderOutputPoint[] {
  const qualifiedName = `(?:[A-Za-z_][\\w.-]*:)?${localName}`;
  const pattern = new RegExp(`<${qualifiedName}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${qualifiedName}\\s*>)`, 'gi');
  const points: TrackBuilderOutputPoint[] = [];
  for (const match of content.matchAll(pattern)) {
    const latitude = xmlNumberAttribute(match[1], 'lat');
    const longitude = xmlNumberAttribute(match[1], 'lon');
    if (latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const innerXml = match[2] ?? '';
    const elevation = firstXmlText(innerXml, 'ele');
    const time = firstXmlText(innerXml, 'time');
    points.push({
      coordinate: [longitude, latitude],
      metadata: innerXml || elevation || time ? {
        elevationMeters: elevation === undefined || !Number.isFinite(Number(elevation)) ? undefined : Number(elevation),
        time,
        gpxInnerXml: innerXml || undefined,
      } : undefined,
    });
  }
  return points;
}

export function trackBuilderSectionPointMetadata(section: TrackBuilderSection): readonly (TrackBuilderPointMetadata | undefined)[] {
  const source = section.sourceCoordinates;
  const sourceMetadata = section.sourcePointMetadata;
  // Slices read source-backed metadata, never pointMetadata first: a slice can
  // happen to contain the same number of points as its source while having different
  // endpoint positions, which silently misaligns the pointMetadata path.
  if (source && sourceMetadata && section.startPosition && section.endPosition) {
    const positions: TrackBuilderLinePosition[] = [section.startPosition];
    const forward = section.startPosition.segmentIndex + section.startPosition.t <= section.endPosition.segmentIndex + section.endPosition.t;
    if (forward) {
      for (let index = section.startPosition.segmentIndex + 1; index <= section.endPosition.segmentIndex; index++) positions.push({ segmentIndex: index, t: 0 });
    } else {
      for (let index = section.startPosition.segmentIndex; index > section.endPosition.segmentIndex; index--) positions.push({ segmentIndex: index - 1, t: 1 });
    }
    positions.push(section.endPosition);
    return positions.slice(0, section.coordinates.length).map(position => trackBuilderMetadataAtPosition(sourceMetadata, position));
  }
  if (section.pointMetadata?.length === section.coordinates.length) return section.pointMetadata;
  return [];
}

export function trackBuilderMetadataAtPosition(metadata: readonly (TrackBuilderPointMetadata | undefined)[], position: TrackBuilderLinePosition): TrackBuilderPointMetadata | undefined {
  if (position.t <= 1e-9) return metadata[position.segmentIndex];
  if (position.t >= 1 - 1e-9) return metadata[position.segmentIndex + 1];
  const left = metadata[position.segmentIndex];
  const right = metadata[position.segmentIndex + 1];
  if (!left && !right) return undefined;
  const leftTime = left?.time ? Date.parse(left.time) : Number.NaN;
  const rightTime = right?.time ? Date.parse(right.time) : Number.NaN;
  return {
    elevationMeters: left?.elevationMeters !== undefined && right?.elevationMeters !== undefined
      ? left.elevationMeters + (right.elevationMeters - left.elevationMeters) * position.t
      : undefined,
    time: Number.isFinite(leftTime) && Number.isFinite(rightTime)
      ? new Date(leftTime + (rightTime - leftTime) * position.t).toISOString()
      : undefined,
  };
}

function serializeGpxPoint(point: TrackBuilderOutputPoint): string {
  const [longitude, latitude] = point.coordinate;
  const original = point.metadata?.gpxInnerXml;
  const children = original !== undefined
    ? original
    : [
      point.metadata?.elevationMeters !== undefined ? `<ele>${point.metadata.elevationMeters}</ele>` : '',
      point.metadata?.time ? `<time>${escapeXml(point.metadata.time)}</time>` : '',
    ].filter(Boolean).join('');
  return children
    ? `      <trkpt lat="${latitude}" lon="${longitude}">${children}</trkpt>`
    : `      <trkpt lat="${latitude}" lon="${longitude}"></trkpt>`;
}

function serializeGpxWaypoint(waypoint: TrackBuilderWaypoint): string {
  const [longitude, latitude] = waypoint.coordinate;
  // Apply edits onto the original body, leaving untouched children (ele, time,
  // link, extensions) with both their content and their schema-mandated order.
  let children = waypoint.gpxInnerXml ?? '';
  children = withXmlChild(children, 'name', waypoint.name);
  children = withXmlChild(children, 'desc', waypoint.description);
  children = withXmlChild(children, 'sym', waypoint.symbol);
  const body = children.trim();
  return body
    ? `  <wpt lat="${latitude}" lon="${longitude}">${body}</wpt>`
    : `  <wpt lat="${latitude}" lon="${longitude}"></wpt>`;
}

// Set, replace, or remove one child element inside a raw XML body. An existing
// element is rewritten where it stands, preserving the surrounding order;
// a new one is appended.
function withXmlChild(inner: string, localName: string, value: string | undefined): string {
  const qualifiedName = `(?:[A-Za-z_][\\w.-]*:)?${localName}`;
  const pattern = new RegExp(`<${qualifiedName}\\b[^>]*?(?:\\/\\s*>|>[\\s\\S]*?<\\/${qualifiedName}\\s*>)`, 'i');
  if (value === undefined || value === '') return inner.replace(pattern, '');
  const replacement = `<${localName}>${escapeXml(value)}</${localName}>`;
  return pattern.test(inner) ? inner.replace(pattern, replacement) : `${inner}${replacement}`;
}

function xmlNumberAttribute(attributes: string, name: string): number | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(attributes);
  if (!match) return undefined;
  const value = Number.parseFloat(match[2]);
  return Number.isFinite(value) ? value : undefined;
}

function firstXmlText(content: string | undefined, localName: string): string | undefined {
  const body = xmlElementBodies(content, localName)[0];
  if (body === undefined) return undefined;
  const text = decodeXml(body.replace(/<[^>]*>/g, '').trim());
  return text || undefined;
}

function decodeXml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
    const token = entity.slice(1, -1).toLowerCase();
    if (token[0] === '#') {
      const hexadecimal = token[1] === 'x';
      const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[token] ?? entity;
  });
}

function getRegistry(): DraftRegistry {
  return sharedRegistryMap<string, TrackBuilderHistory>(REGISTRY_KEY);
}
