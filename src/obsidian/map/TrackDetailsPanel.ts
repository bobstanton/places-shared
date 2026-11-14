import { setIcon } from '../../services/index';
import type { MapPlace } from '../../place/index';
import type { TrackInspection } from '../../settings/index';
import { logger as rootLogger } from '../../utils/index';
import { TRACK_PLAYBACK_POSITION_EVENT } from '../../map/TrackEvents';
import { renderTrackInspectionFields } from '../../map/index';

const logger = rootLogger.scope('TrackInteractions');

export type InspectTrack = (place: MapPlace, coordinate: { latitude: number; longitude: number }, signal?: AbortSignal) => Promise<TrackInspection | null>;

export interface TrackDetailsPanelOptions {
  readonly container: HTMLElement;
  readonly openLink: (linkPath: string) => void;
  readonly onDispose?: () => void;
}

export class TrackDetailsPanel {
  private readonly element: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly listener: (event: Event) => void;
  private place?: MapPlace;
  private inspect?: InspectTrack;
  private requestVersion = 0;
  private inspectionController = new AbortController();
  private timer?: number;
  private pendingCoordinate?: { latitude: number; longitude: number };
  private disposed = false;

  constructor(private readonly options: TrackDetailsPanelOptions) {
    this.element = options.container.createDiv({ cls: 'places-track-details-panel' });
    const header = this.element.createDiv({ cls: 'places-track-details-panel-header' });

    this.titleEl = header.createDiv({ cls: 'places-track-details-panel-title' });
    const close = header.createEl('button', { cls: 'places-track-details-panel-close', attr: { type: 'button', 'aria-label': 'Close track details' } });

    setIcon(close, 'x');
    close.addEventListener('click', () => this.dispose());
    this.bodyEl = this.element.createDiv({ cls: 'places-track-details-panel-body' });

    this.listener = event => {
      const detail = (event as CustomEvent<{ trackPath?: string; latitude?: number; longitude?: number }>).detail;

      if (!detail || !this.place?.filePath || detail.trackPath !== this.place.filePath) return;
      if (detail.latitude === undefined || detail.longitude === undefined) return;
      this.scheduleUpdate({ latitude: detail.latitude, longitude: detail.longitude });
    };

    this.element.ownerDocument.addEventListener(TRACK_PLAYBACK_POSITION_EVENT, this.listener);
  }

  show(place: MapPlace, coordinate: { latitude: number; longitude: number }, inspect: InspectTrack | undefined): void {
    if (this.disposed) return;

    if (this.place !== place || this.inspect !== inspect) {
      this.inspectionController.abort();
      this.inspectionController = new AbortController();
      if (this.timer !== undefined) this.element.ownerDocument.defaultView?.clearTimeout(this.timer);
      this.timer = undefined;
      this.pendingCoordinate = undefined;
    }

    this.place = place;
    this.inspect = inspect;

    this.titleEl.empty();
    if (place.icon) this.titleEl.createSpan({ text: `${place.icon} ` });
    const link = this.titleEl.createEl('a', { text: place.name, href: place.filePath ?? '#' });
    const filePath = place.filePath;

    if (filePath) {
      link.addEventListener('click', event => {
        event.preventDefault();
        this.options.openLink(filePath);
      });
    }

    this.element.removeClass('is-hidden');
    this.update(coordinate);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestVersion++;
    this.inspectionController.abort();
    if (this.timer !== undefined) this.element.ownerDocument.defaultView?.clearTimeout(this.timer);
    this.element.ownerDocument.removeEventListener(TRACK_PLAYBACK_POSITION_EVENT, this.listener);
    this.element.remove();
    this.options.onDispose?.();
  }

  private scheduleUpdate(coordinate: { latitude: number; longitude: number }): void {
    this.pendingCoordinate = coordinate;
    if (this.timer !== undefined) return;
    this.timer = this.element.ownerDocument.defaultView?.setTimeout(() => {
      this.timer = undefined;
      const latest = this.pendingCoordinate;

      this.pendingCoordinate = undefined;
      if (latest) this.update(latest);
    }, 80);
  }

  private update(coordinate: { latitude: number; longitude: number }): void {
    const place = this.place;
    const inspect = this.inspect;

    if (!place || !inspect) return;

    const version = ++this.requestVersion;

    void inspect(place, coordinate, this.inspectionController.signal).then(inspection => {
      if (version !== this.requestVersion || !this.element.isConnected) return;
      this.bodyEl.empty();

      if (!inspection?.fields.length) {
        this.bodyEl.setText('No details available at this point.');

        return;
      }

      renderTrackInspectionFields(this.bodyEl, inspection.fields);
    }).catch(error => {
      if (version !== this.requestVersion) return;
      this.bodyEl.setText('Track details unavailable.');
      logger.warn('Track details panel update failed', error);
    });
  }
}
