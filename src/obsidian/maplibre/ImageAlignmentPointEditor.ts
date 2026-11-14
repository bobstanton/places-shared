import { setIcon, stringifyYaml } from 'obsidian';
import { getErrorMessage, isRecord, sharedRegistryMap } from "../../utils/index";
import { parseCodeBlockYaml } from "../../settings/index";
import { isImageOverlayDefinition } from "../../overlay/index";
import type { ImageAlignmentMap, ImageAlignmentMarker, ImageOverlayAlignmentCorner, ImageOverlayAlignmentCorners } from './ImageOverlayAlignment';
import { AlignmentHistory, cloneAlignment, fitAlignmentPoints, snapAlignmentPoint, type AlignmentSnapshot, type AlignmentStatus, type ControlPointAlignment, type PixelPoint } from './ImageAlignmentControlPoints';

const SESSIONS = Symbol.for('places.map.image-alignment-point-sessions');

interface PointSession { source: string; state: AlignmentSnapshot }
function sessions(): Map<string, PointSession> { return sharedRegistryMap<string, PointSession>(SESSIONS); }

export function getPointAlignmentSession(key: string, source: string): AlignmentSnapshot | undefined {
  const saved = sessions().get(key);

  if (saved && saved.source !== source) { sessions().delete(key);

 return undefined; }

  return saved ? cloneAlignment(saved.state) : undefined;
}

export function formatPointAlignmentYaml(source: string, state: AlignmentSnapshot): string {
  const parsed = parseCodeBlockYaml(source);
  const entries: unknown[] = Array.isArray(parsed.overlays) ? parsed.overlays : [parsed.overlays];

  parsed.overlays = entries.map(entry => {
    if (!isRecord(entry) || !isImageOverlayDefinition(entry)) return entry;
    const image = { ...entry };

    delete image.bounds;
    image.corners = ['nw', 'ne', 'se', 'sw'].flatMap(key => {
      const corner = state.corners[key as keyof ImageOverlayAlignmentCorners];

      return [corner.lat.toFixed(8), corner.lng.toFixed(8)];
    }).join(',');
    image.alignment = cloneAlignment(state.alignment);

    return image;
  });

  return stringifyYaml(parsed).trimEnd();
}

interface PointEditorOptions {
  container: HTMLElement;
  mapContainer: HTMLElement;
  map: ImageAlignmentMap;
  imageUrl: string;
  width: number;
  height: number;
  source: string;
  sessionKey: string;
  alignment: ControlPointAlignment;
  formatDistance?: (meters: number) => string;
  getCorners(): ImageOverlayAlignmentCorners;
  applyCorners(corners: ImageOverlayAlignmentCorners): void;
  onModeChange(matching: boolean): void;
  onOutputChange?(alignmentYaml: string | undefined): void;
}

export class ImageAlignmentPointEditor {
  private alignment: ControlPointAlignment;
  private status: AlignmentStatus;
  private history: AlignmentHistory;
  private matching = false;
  private adding = false;
  private pending: { pixel?: PixelPoint; latlng?: [number, number] } = {};
  private selected = -1;
  private snap = false;
  private showOverlay = true;
  private disposed = false;
  private removers: (() => void)[] = [];
  private markers: ImageAlignmentMarker[] = [];
  private previewMarker?: ImageAlignmentMarker;
  private previewElement: HTMLElement;
  private toolbar: HTMLElement;
  private controls: HTMLElement;
  private panes: HTMLElement;
  private imagePane: HTMLElement;
  private viewport: HTMLElement;
  private imageContent: HTMLElement;
  private pointList: HTMLElement;
  private prompt: HTMLElement;
  private statusEl: HTMLElement;
  private fitButton: HTMLButtonElement;
  private addPairButton: HTMLButtonElement;
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;
  private adjustButton: HTMLButtonElement;
  private matchButton: HTMLButtonElement;
  private fitSelect: HTMLSelectElement;
  private scale = 1;
  private offset: PixelPoint = [0, 0];
  private imageViewInitialized = false;
  private imageDrag?: { id: number; start: PixelPoint; offset: PixelPoint; pair: number; original?: PixelPoint; moved: boolean };

  constructor(private options: PointEditorOptions) {
    const { container, mapContainer, imageUrl, width, height, source, sessionKey } = options;
    const saved = getPointAlignmentSession(sessionKey, source);

    this.alignment = cloneAlignment(saved?.alignment ?? options.alignment);
    this.status = saved?.status ?? 'Not fitted';
    this.history = new AlignmentHistory(this.snapshot());
    this.toolbar = container.createDiv({ cls: 'places-alignment-toolbar' });
    container.insertBefore(this.toolbar, mapContainer);
    this.adjustButton = this.button(this.toolbar, 'Adjust image', () => this.setMatching(false));
    this.matchButton = this.button(this.toolbar, 'Match points', () => this.setMatching(true));
    const historyTools = this.toolbar.createDiv({ cls: 'places-alignment-history' });

    this.undoButton = this.iconButton(historyTools, 'Undo', 'undo-2', () => this.restore(this.history.undo()));
    this.redoButton = this.iconButton(historyTools, 'Redo', 'redo-2', () => this.restore(this.history.redo()));
    this.statusEl = this.toolbar.createSpan({ cls: 'places-alignment-status' });
    this.statusEl.setAttribute('role', 'status');

    this.controls = container.createDiv({ cls: 'places-alignment-point-controls' });
    container.insertBefore(this.controls, mapContainer);
    this.addPairButton = this.button(this.controls, 'Add point pair', () => {
      this.adding = true; this.pending = {}; this.render();
    });
    this.fitSelect = this.controls.createEl('select');
    this.fitSelect.setAttribute('aria-label', 'Fitting method');
    this.fitSelect.createEl('option', { text: 'Preserve proportions', value: 'similarity' });
    this.fitSelect.createEl('option', { text: 'Allow stretching/skew', value: 'affine' });
    this.listen(this.fitSelect, 'change', () => {
      this.alignment.fit = this.fitSelect.value as ControlPointAlignment['fit'];
      this.changedPoints();
    });
    this.fitButton = this.button(this.controls, 'Fit image', () => this.fit());
    this.checkbox(this.controls, 'Snap to track', false, value => { this.snap = value; this.clearPreview(); });
    this.checkbox(this.controls, 'Show overlay', true, value => {
      this.showOverlay = value; options.map.setImageVisible?.(value);
    });
    this.prompt = this.controls.createDiv({ cls: 'places-alignment-prompt' });
    this.prompt.setAttribute('role', 'status');
    this.pointList = this.controls.createDiv({ cls: 'places-alignment-point-list' });
    this.listen(this.pointList, 'click', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-pair]');

      if (!target) return;
      const index = Number(target.dataset.pair);

      if (target.dataset.action === 'cancel') { this.cancelPair();

 return; }

      if (target.dataset.action === 'delete') {
        this.alignment.points.splice(index, 1); this.selected = -1;
        if (!this.alignment.points.length) this.alignment.imageSize = [width, height];
        this.changedPoints();
      } else if (target.dataset.action === 'enable') {
        this.alignment.points[index].enabled = (target as HTMLInputElement).checked;
        this.changedPoints();
      } else { this.selected = index; this.render(); }
    });

    this.panes = container.createDiv({ cls: 'places-alignment-panes' });
    container.insertBefore(this.panes, mapContainer);
    this.imagePane = this.panes.createDiv({ cls: 'places-alignment-original' });
    this.viewport = this.imagePane.createDiv({ cls: 'places-alignment-image-viewport' });
    this.viewport.setAttribute('aria-label', 'Image point selection');
    this.viewport.tabIndex = 0;
    const imageTools = this.viewport.createDiv({ cls: 'places-alignment-pane-tools' });

    this.iconButton(imageTools, 'View whole image', 'maximize', () => this.resetImageView());
    this.iconButton(imageTools, 'Zoom image in', 'plus', () => this.zoom(1.25));
    this.iconButton(imageTools, 'Zoom image out', 'minus', () => this.zoom(0.8));
    this.imageContent = this.viewport.createDiv({ cls: 'places-alignment-image-content' });
    this.imageContent.setCssProps({ width: `${width}px`, height: `${height}px` });
    const image = this.imageContent.createEl('img', { attr: { src: imageUrl, alt: 'Image for matching points', draggable: 'false' } });

    image.width = width; image.height = height;
    this.panes.appendChild(mapContainer);
    this.previewElement = container.ownerDocument.createElement('div');
    this.previewElement.className = 'places-alignment-snap-preview';
    this.previewElement.setAttribute('aria-hidden', 'true');
    this.bindImageEvents();
    options.map.on('click', event => {
      if (!this.matching || !this.adding || this.disposed) return;
      if ((event.originalEvent.target as HTMLElement | null)?.closest?.('.places-alignment-point-marker')) return;
      const point = this.snapped(event.lngLat) ?? event.lngLat;

      this.pending.latlng = [point.lat, normalizeLongitude(point.lng)];
      this.completePair();
    });
    options.map.on('mousemove', event => {
      if (!this.matching || !this.adding || !this.snap || this.disposed) return;
      const snapped = this.snapped(event.lngLat);

      if (!snapped) { this.clearPreview();

 return; }

      if (!this.previewMarker) {
        this.previewMarker = options.map.createMarker(snapped, this.previewElement);
        this.previewMarker.setDraggable?.(false);
      }

      this.previewMarker.setLngLat([snapped.lng, snapped.lat]);
      this.previewElement.hidden = false;
    });
    this.listen(mapContainer, 'mouseleave', () => this.clearPreview());
    this.listen(container, 'keydown', event => {
      if ((event as KeyboardEvent).key === 'Escape') this.cancelPair();
    });
    this.listen(container.ownerDocument.defaultView!, 'blur', () => { this.cancelImageDrag(); this.render(); });
    const observer = new ResizeObserver(() => {
      if (this.matching && !this.imageViewInitialized) this.resetImageView();
    });

    observer.observe(this.viewport);
    this.removers.push(() => observer.disconnect());
    this.setMatching(false);
  }

  get isMatching(): boolean { return this.matching; }

  getAlignmentYaml(): string { return formatPointAlignmentYaml(this.options.source, this.snapshot()); }

  viewTrack(): void {
    const positions = this.options.map.getReferenceLines?.().flat() ?? [];

    if (!positions.length) {
      this.prompt.textContent = 'No reference track loaded'; this.prompt.hidden = false;

 return;
    }

    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;

    for (const [lng, lat] of positions) { west = Math.min(west, lng); east = Math.max(east, lng); south = Math.min(south, lat); north = Math.max(north, lat); }
    this.options.map.fitBounds({ nw: { lng: west, lat: north }, ne: { lng: east, lat: north }, se: { lng: east, lat: south }, sw: { lng: west, lat: south } });
  }

  manualChanged(): void {
    this.status = this.alignment.points.length ? 'Manually adjusted' : 'Not fitted';
    this.commit();
  }

  private snapshot(): AlignmentSnapshot {
    return cloneAlignment({ corners: this.options.getCorners(), alignment: this.alignment, status: this.status });
  }
  private commit(): void {
    const state = this.snapshot();

    this.history.commit(state);
    sessions().set(this.options.sessionKey, { source: this.options.source, state });
    this.render();
  }
  private restore(state: AlignmentSnapshot): void {
    this.cancelImageDrag();
    this.alignment = state.alignment; this.status = state.status;
    this.pending = {}; this.adding = false;
    this.options.applyCorners(state.corners);
    sessions().set(this.options.sessionKey, { source: this.options.source, state: this.snapshot() });
    this.render();
  }
  private changedPoints(): void {
    this.status = 'Points changed — fit again';
    this.commit();
  }
  private fit(): void {
    try {
      const fitted = fitAlignmentPoints(this.alignment, this.options.width, this.options.height);

      this.options.applyCorners(fitted.corners);
      this.status = 'Fit up to date';
      this.alignment.imageSize = [this.options.width, this.options.height];
      this.commit();
      this.options.map.fitBounds(fitted.corners);
    } catch (error) {
 this.prompt.textContent = getErrorMessage(error); this.prompt.hidden = false; 
}
  }
  private setMatching(value: boolean): void {
    this.cancelImageDrag();
    this.matching = value; this.adding = false; this.pending = {};
    this.controls.hidden = !value; this.imagePane.hidden = !value;
    this.panes.classList.toggle('is-matching', value);
    this.adjustButton.setAttribute('aria-pressed', String(!value));
    this.matchButton.setAttribute('aria-pressed', String(value));
    this.options.onModeChange(value);
    this.options.map.setPointMatching?.(value);
    this.options.map.setImageVisible?.(!value || this.showOverlay);
    this.options.map.resize();
    if (value && !this.imageViewInitialized) this.resetImageView();
    this.render();
  }
  private cancelPair(): void {
    this.adding = false; this.pending = {}; this.render();
  }
  private completePair(): void {
    if (this.pending.pixel && this.pending.latlng) {
      if (!this.alignment.points.length) this.alignment.imageSize = [this.options.width, this.options.height];
      this.alignment.points.push({ pixel: this.pending.pixel, latlng: this.pending.latlng });
      this.selected = this.alignment.points.length - 1;
      this.pending = {}; this.adding = false; this.changedPoints();
    } else this.render();
  }
  private snapped(point: ImageOverlayAlignmentCorner): ImageOverlayAlignmentCorner | undefined {
    return this.snap ? snapAlignmentPoint(point, this.options.map.getReferenceLines?.() ?? [], this.options.map) : undefined;
  }
  private clearPreview(): void { this.previewElement.hidden = true; }

  private render(): void {
    if (this.disposed) return;
    this.addPairButton.disabled = this.adding;
    this.undoButton.disabled = !this.history.canUndo;
    this.redoButton.disabled = !this.history.canRedo;
    this.statusEl.textContent = this.status === 'Points changed — fit again' ? 'Fit outdated' : this.status;
    this.statusEl.hidden = this.status === 'Not fitted';
    this.fitSelect.value = this.alignment.fit;
    let errors: (number | null)[] = [];

    try {
      const fit = fitAlignmentPoints(this.alignment, this.options.width, this.options.height);

      this.fitButton.disabled = false;
      this.fitButton.title = '';
      if (this.status === 'Fit up to date') errors = fit.errors;
    } catch (error) {
      this.fitButton.disabled = true; this.fitButton.title = getErrorMessage(error);
    }

    this.prompt.hidden = !this.adding;
    this.prompt.textContent = !this.adding ? ''
      : this.pending.pixel ? 'Select map point'
      : this.pending.latlng ? 'Select image point'
      : 'Select first point';
    if (this.adding) this.fitButton.disabled = true;
    this.clearPreview();
    this.pointList.replaceChildren();
    this.markers.forEach(marker => marker.remove?.()); this.markers = [];
    this.imageContent.querySelectorAll('.places-alignment-point-marker').forEach(marker => marker.remove());
    this.alignment.points.forEach((pair, index) => {
      const row = this.pointList.createDiv({ cls: 'places-alignment-point-row' });
      const enabled = row.createEl('input', { type: 'checkbox' });

      enabled.checked = pair.enabled !== false; enabled.dataset.pair = String(index); enabled.dataset.action = 'enable';
      enabled.setAttribute('aria-label', `Use pair ${index + 1}`);
      const select = row.createEl('button', { text: `Pair ${index + 1}`, attr: { type: 'button' } });

      select.dataset.pair = String(index); select.setAttribute('aria-pressed', String(index === this.selected));
      if (errors[index] != null) row.createSpan({ text: `${this.options.formatDistance?.(errors[index]) ?? `${errors[index].toFixed(1)} m`} mismatch` });
      const remove = row.createEl('button', { cls: 'places-alignment-icon-button', attr: { type: 'button', 'aria-label': `Delete pair ${index + 1}`, title: `Delete pair ${index + 1}` } });

      setIcon(remove, 'x');
      remove.dataset.pair = String(index); remove.dataset.action = 'delete';
      if (!this.matching) return;
      this.addImageMarker(pair.pixel, index);
      const el = this.markerElement(index);
      const marker = this.options.map.createMarker({ lat: pair.latlng[0], lng: pair.latlng[1] }, el);

      this.markers.push(marker);
      el.addEventListener('click', event => { event.stopPropagation(); this.selected = index; this.render(); });
      marker.on('drag', () => {
        const raw = marker.getLngLat(), point = this.snapped(raw) ?? raw;

        pair.latlng = [point.lat, normalizeLongitude(point.lng)]; marker.setLngLat([point.lng, point.lat]);
      });
      marker.on('dragend', () => { this.selected = index; this.changedPoints(); });
    });

    if (this.adding) {
      const row = this.pointList.createDiv({ cls: 'places-alignment-point-row is-pending' });

      row.createSpan({ text: `Pair ${this.alignment.points.length + 1}`, cls: 'places-alignment-pending-label' });
      const remove = row.createEl('button', { cls: 'places-alignment-icon-button', attr: { type: 'button', 'aria-label': 'Delete pending pair', title: 'Delete pending pair' } });

      setIcon(remove, 'x'); remove.dataset.pair = '-1'; remove.dataset.action = 'cancel';
    }

    if (this.matching && this.pending.pixel) this.addImageMarker(this.pending.pixel, -1);

    if (this.matching && this.pending.latlng) {
      const marker = this.options.map.createMarker({ lat: this.pending.latlng[0], lng: this.pending.latlng[1] }, this.markerElement(-1));

      marker.setDraggable?.(false); this.markers.push(marker);
    }

    this.updateImageTransform();
    this.options.onOutputChange?.(this.matching ? this.getAlignmentYaml() : undefined);
  }

  private markerElement(index: number): HTMLElement {
    const el = this.options.container.ownerDocument.createElement('button');

    el.type = 'button'; el.className = 'places-alignment-point-marker';
    el.textContent = index < 0 ? '+' : String(index + 1);
    el.setAttribute('aria-label', index < 0 ? 'Pending point' : `Point pair ${index + 1}`);
    el.classList.toggle('is-selected', index >= 0 && index === this.selected);
    el.classList.toggle('is-disabled', index >= 0 && this.alignment.points[index].enabled === false);
    el.dataset.point = String(index);

    return el;
  }
  private addImageMarker(pixel: PixelPoint, index: number): void {
    const el = this.markerElement(index);

    el.setCssProps({ left: `${pixel[0]}px`, top: `${pixel[1]}px` });
    this.imageContent.appendChild(el);
  }
  private updateImageTransform(): void {
    this.imageContent.setCssProps({ transform: `translate(${this.offset[0]}px, ${this.offset[1]}px) scale(${this.scale})` });
    this.imageContent.querySelectorAll<HTMLElement>('.places-alignment-point-marker').forEach(el => {
      el.setCssProps({ transform: `translate(-50%, -50%) scale(${1 / this.scale})` });
    });
  }
  private resetImageView(): void {
    const width = this.viewport.clientWidth, height = this.viewport.clientHeight;

    if (!width || !height) return;
    this.scale = Math.min(width / this.options.width, height / this.options.height) * 0.9;
    this.offset = [(width - this.options.width * this.scale) / 2, (height - this.options.height * this.scale) / 2];
    this.imageViewInitialized = true; this.updateImageTransform();
  }
  private zoom(factor: number, point: PixelPoint = [this.viewport.clientWidth / 2, this.viewport.clientHeight / 2]): void {
    const next = Math.max(0.0001, Math.min(32, this.scale * factor));

    this.offset = [point[0] - (point[0] - this.offset[0]) * next / this.scale, point[1] - (point[1] - this.offset[1]) * next / this.scale];
    this.scale = next; this.updateImageTransform();
  }
  private localPoint(event: MouseEvent): PixelPoint {
    const rect = this.viewport.getBoundingClientRect();

    return [(event.clientX - rect.left) * (this.viewport.offsetWidth / rect.width || 1),
      (event.clientY - rect.top) * (this.viewport.offsetHeight / rect.height || 1)];
  }
  private pixelAt(point: PixelPoint): PixelPoint {
    return [(point[0] - this.offset[0]) / this.scale, (point[1] - this.offset[1]) / this.scale];
  }
  private cancelImageDrag(): void {
    const drag = this.imageDrag;

    if (drag?.original && this.alignment.points[drag.pair]) this.alignment.points[drag.pair].pixel = drag.original;
    if (drag && this.viewport.hasPointerCapture?.(drag.id)) this.viewport.releasePointerCapture(drag.id);
    this.imageDrag = undefined;
  }
  private bindImageEvents(): void {
    this.listen(this.viewport, 'wheel', event => {
      const wheel = event as WheelEvent;

 wheel.preventDefault(); wheel.stopPropagation();
      this.zoom(Math.exp(-Math.max(-100, Math.min(100, wheel.deltaY)) * 0.002), this.localPoint(wheel));
    }, { passive: false });
    this.listen(this.viewport, 'pointerdown', event => {
      const pointer = event as PointerEvent;

      if (pointer.button !== 0 || this.imageDrag || (pointer.target as HTMLElement).closest('.places-alignment-pane-tools')) return;
      const marker = (pointer.target as HTMLElement).closest<HTMLElement>('[data-point]');
      const pair = marker ? Number(marker.dataset.point) : -1;

      this.imageDrag = { id: pointer.pointerId, start: this.localPoint(pointer), offset: [...this.offset], pair,
        original: pair >= 0 ? [...this.alignment.points[pair].pixel] : undefined, moved: false };
      this.viewport.setPointerCapture?.(pointer.pointerId); pointer.preventDefault(); pointer.stopPropagation();
    });
    this.listen(this.viewport, 'pointermove', event => {
      const pointer = event as PointerEvent, drag = this.imageDrag;

      if (!drag || pointer.pointerId !== drag.id) return;
      const point = this.localPoint(pointer), dx = point[0] - drag.start[0], dy = point[1] - drag.start[1];

      drag.moved ||= Math.hypot(dx, dy) > 4;
      if (!drag.moved) return;

      if (drag.pair >= 0) {
        const pixel = this.pixelAt(point);
        const bounded: PixelPoint = [Math.max(0, Math.min(this.options.width, pixel[0])), Math.max(0, Math.min(this.options.height, pixel[1]))];

        this.alignment.points[drag.pair].pixel = bounded;
        const marker = this.imageContent.querySelector<HTMLElement>(`[data-point="${drag.pair}"]`);

        marker?.setCssProps({ left: `${bounded[0]}px`, top: `${bounded[1]}px` });
      } else { this.offset = [drag.offset[0] + dx, drag.offset[1] + dy]; this.updateImageTransform(); }

      pointer.stopPropagation();
    });
    this.listen(this.viewport, 'pointerup', event => {
      const pointer = event as PointerEvent, drag = this.imageDrag;

      if (!drag || pointer.pointerId !== drag.id) return;
      this.imageDrag = undefined;
      if (this.viewport.hasPointerCapture?.(drag.id)) this.viewport.releasePointerCapture(drag.id);

      if (drag.pair >= 0) {
        this.selected = drag.pair;
        if (drag.moved) this.changedPoints(); else this.render();
      } else if (!drag.moved && this.adding) {
        const pixel = this.pixelAt(this.localPoint(pointer));

        if (pixel[0] >= 0 && pixel[0] <= this.options.width && pixel[1] >= 0 && pixel[1] <= this.options.height) {
          this.pending.pixel = pixel; this.completePair();
        }
      }

      pointer.stopPropagation();
    });
    this.listen(this.viewport, 'pointercancel', () => { this.cancelImageDrag(); this.render(); });
  }
  private button(parent: HTMLElement, text: string, action: () => void): HTMLButtonElement {
    const button = parent.createEl('button', { text, attr: { type: 'button' } });

    this.listen(button, 'click', action);

 return button;
  }
  private iconButton(parent: HTMLElement, label: string, icon: string, action: () => void): HTMLButtonElement {
    const button = parent.createEl('button', { cls: 'places-alignment-icon-button', attr: { type: 'button', 'aria-label': label, title: label } });

    setIcon(button, icon); this.listen(button, 'click', action);

 return button;
  }
  private checkbox(parent: HTMLElement, text: string, checked: boolean, action: (value: boolean) => void): void {
    const label = parent.createEl('label');
    const input = label.createEl('input', { type: 'checkbox' });

 input.checked = checked;
    label.appendText(text); this.listen(input, 'change', () => action(input.checked));
  }
  private listen(target: EventTarget, type: string, handler: (event: Event) => void, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    this.removers.push(() => target.removeEventListener(type, handler, options));
  }
  destroy(): void {
    this.disposed = true; this.cancelImageDrag();
    this.removers.forEach(remove => remove());
    this.markers.forEach(marker => marker.remove?.()); this.previewMarker?.remove?.();
  }
}

function normalizeLongitude(lng: number): number { return lng >= -180 && lng <= 180 ? lng : ((lng + 180) % 360 + 360) % 360 - 180; }
