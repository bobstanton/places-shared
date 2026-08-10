import type { MapPlace } from '../Place';
import type { TrackInspection } from '../settings/MapConfiguration';

// The "distance, elevation, speed at this point" rows shown after clicking a
// track. Every popup path must render these rows through this; the stylesheet
// targets the label span.
export function renderTrackInspectionFields(container: HTMLElement, fields: TrackInspection['fields']): void {
  for (const field of fields) {
    const row = container.createDiv({ cls: 'places-track-inspection-row' });
    row.createSpan({ cls: 'places-track-inspection-label', text: `${field.label}: ` });
    row.createSpan({ text: field.value });
  }
}

export interface TrackInspectionSectionOptions {
  readonly host: HTMLElement;
  readonly place: MapPlace;
  readonly coordinate: { readonly latitude: number; readonly longitude: number };
  readonly inspectTrack: (place: MapPlace, coordinate: { latitude: number; longitude: number }) => Promise<TrackInspection | null>;
  // Called once rows are in the DOM, for engines whose popups must be told to re-measure.
  readonly onRendered?: () => void;
}

// Replaces any previous section. Inspection is a source-file read: a loading
// row shows until it settles, and a result with nothing to report removes the
// section.
export function appendTrackInspectionSection(options: TrackInspectionSectionOptions): void {
  const { host, place, coordinate, inspectTrack, onRendered } = options;
  host.querySelector('.places-track-inspection')?.remove();
  const section = host.createDiv({ cls: 'places-track-inspection places-popup-loading', text: 'Loading track details...' });

  void inspectTrack(place, coordinate)
    .then(inspection => {
      section.empty();
      section.removeClass('places-popup-loading');
      if (!inspection?.fields.length) {
        section.remove();
        return;
      }
      renderTrackInspectionFields(section, inspection.fields);
      onRendered?.();
    })
    .catch(() => section.remove());
}
