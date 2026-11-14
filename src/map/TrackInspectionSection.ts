import type { MapPlace } from '../Place';
import type { TrackInspection } from '../settings/MapConfiguration';
import { createDiv, createSpan, emptyElement } from '../utils/Dom';

const inspections = new WeakMap<HTMLElement, AbortController>();

export function renderTrackInspectionFields(container: HTMLElement, fields: TrackInspection['fields']): void {
  for (const field of fields) {
    const row = createDiv(container, { cls: 'places-track-inspection-row' });

    createSpan(row, { cls: 'places-track-inspection-label', text: `${field.label}: ` });
    createSpan(row, { text: field.value });
  }
}

export interface TrackInspectionSectionOptions {
  readonly host: HTMLElement;
  readonly place: MapPlace;
  readonly coordinate: { readonly latitude: number; readonly longitude: number };
  readonly inspectTrack: (place: MapPlace, coordinate: { latitude: number; longitude: number }, signal?: AbortSignal) => Promise<TrackInspection | null>;
  readonly signal?: AbortSignal;
  readonly onRendered?: () => void;
}

export function appendTrackInspectionSection(options: TrackInspectionSectionOptions): void {
  const { host, place, coordinate, inspectTrack, onRendered, signal } = options;

  inspections.get(host)?.abort();
  if (signal?.aborted) return;
  const controller = new AbortController();

  inspections.set(host, controller);
  const abort = () => controller.abort();

  signal?.addEventListener('abort', abort, { once: true });
  controller.signal.addEventListener('abort', () => {
    signal?.removeEventListener('abort', abort);
    if (inspections.get(host) === controller) inspections.delete(host);
  }, { once: true });
  host.querySelector('.places-track-inspection')?.remove();
  const section = createDiv(host, { cls: 'places-track-inspection places-popup-loading', text: 'Loading track details...' });

  void inspectTrack(place, coordinate, controller.signal)
    .then(inspection => {
      if (controller.signal.aborted || section.parentElement !== host) return;
      emptyElement(section);
      section.classList.remove('places-popup-loading');

      if (!inspection?.fields.length) {
        section.remove();

        return;
      }

      renderTrackInspectionFields(section, inspection.fields);
      onRendered?.();
    })
    .catch(() => section.remove());
}
