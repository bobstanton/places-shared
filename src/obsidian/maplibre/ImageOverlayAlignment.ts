import { App, MarkdownPostProcessorContext, MarkdownRenderChild, normalizePath, setIcon, TFile } from "obsidian";
import { getErrorMessage, isRecord, renderError, renderMapSurfaceError, renderMapSupplementalError, loggedRequestUrl as requestUrl, sharedRegistryMap } from "../../utils/index";
import { copyToClipboard } from "../utils/index";
import { DEG_TO_RAD, parseCoordinate } from "../../geo/index";
import { parseCodeBlockYaml, type MapSourceContext } from "../../settings/index";
import { isImageOverlayDefinition } from "../../overlay/index";
import { parseControlPointAlignment, type ControlPointAlignment } from './ImageAlignmentControlPoints';
import { ImageAlignmentPointEditor, getPointAlignmentSession } from './ImageAlignmentPointEditor';

export interface ImageOverlayAlignmentCorner {
  lat: number;
  lng: number;
}

export type ImageOverlayAlignmentCorners = {
  nw: ImageOverlayAlignmentCorner;
  ne: ImageOverlayAlignmentCorner;
  se: ImageOverlayAlignmentCorner;
  sw: ImageOverlayAlignmentCorner;
};

const ALIGNMENT_SESSION_REGISTRY_KEY = Symbol.for('places.map.image-overlay-alignment-sessions');

type ImageOverlayAlignmentSessionRegistry = Map<string, ImageOverlayAlignmentCorners>;

export function imageOverlayAlignmentSessionKey(source: MapSourceContext, image: string): string {
  const path = source.path ?? '';
  const block = source.lineStart ?? 0;

  return `${path}:${block}:image-align:${image}`;
}

export function getImageOverlayAlignmentSessionCorners(key: string): ImageOverlayAlignmentCorners | undefined {
  const corners = getImageOverlayAlignmentSessionRegistry().get(key);

  return corners ? cloneImageOverlayAlignmentCorners(corners) : undefined;
}

export function setImageOverlayAlignmentSessionCorners(key: string, corners: ImageOverlayAlignmentCorners): void {
  getImageOverlayAlignmentSessionRegistry().set(key, cloneImageOverlayAlignmentCorners(corners));
}

export interface ImageOverlayAlignmentSettings {
  image?: string;
  height?: string;
  style?: string;
  opacity?: number;
  initialZoom?: number;
  initialCenter?: [number, number];
  initialCorners?: ImageOverlayAlignmentCorners;
  referenceOverlays?: unknown[];
  alignment?: ControlPointAlignment;
}

export interface ImageAlignmentMarker {
  setLngLat(position: [number, number]): void;
  getLngLat(): ImageOverlayAlignmentCorner;
  on(type: 'drag' | 'dragend', handler: () => void): void;
  remove?(): void;
  setDraggable?(draggable: boolean): void;
}

export interface ImageAlignmentPointerEvent {
  lngLat: ImageOverlayAlignmentCorner;
  originalEvent: MouseEvent;
  readonly defaultPrevented: boolean;
  preventDefault(): void;
}

export interface ImageAlignmentWheelEvent {
  originalEvent: WheelEvent;
  preventDefault(): void;
}

export interface ImageAlignmentMapEventMap {
  load: unknown;
  click: ImageAlignmentPointerEvent;
  mousedown: ImageAlignmentPointerEvent;
  mousemove: ImageAlignmentPointerEvent;
  wheel: ImageAlignmentWheelEvent;
}

export interface ImageAlignmentMap {
  on<K extends keyof ImageAlignmentMapEventMap>(type: K, handler: (event: ImageAlignmentMapEventMap[K]) => void): void;
  resize(): void;
  getCanvas(): HTMLCanvasElement;
  unproject(point: [number, number]): ImageOverlayAlignmentCorner;
  project(point: ImageOverlayAlignmentCorner): { x: number; y: number };
  addImageOverlay(imageUrl: string, coordinates: ImageOverlayCoordinates, opacity: number): void;
  updateImageOverlay(coordinates: ImageOverlayCoordinates): void;
  setImageVisible?(visible: boolean): void;
  setPointMatching?(matching: boolean): void;
  getReferenceLines?(): readonly (readonly [number, number][])[];
  createMarker(position: ImageOverlayAlignmentCorner, element: HTMLElement): ImageAlignmentMarker;
  fitBounds(corners: ImageOverlayAlignmentCorners): void;
  remove(): void;
  zoomIn?(): void;
  zoomOut?(): void;
  addReferenceOverlays?(definitions: readonly unknown[], sourcePath: string): Promise<readonly { path: string; error: string }[]>;
}

export type ImageOverlayCoordinates = [[number, number], [number, number], [number, number], [number, number]];

export interface ImageOverlayAlignmentAdapter {
  formatDistance?: (meters: number) => string;
  createMap(container: HTMLElement, settings: ImageOverlayAlignmentSettings): ImageAlignmentMap;
  missingConfiguration?: {
    title: string;
    message: string;
  };
  showZoomButtons?: boolean;
}

export interface MapGlAlignmentMapLike {
  on<K extends keyof ImageAlignmentMapEventMap>(type: K, handler: (event: ImageAlignmentMapEventMap[K]) => void): void;
  resize(): void;
  remove(): void;
  getCanvas(): HTMLCanvasElement;
  unproject(point: [number, number]): ImageOverlayAlignmentCorner;
  project(point: ImageOverlayAlignmentCorner): { x: number; y: number };
  addSource(id: string, source: {
    type: 'image';
    url: string;
    coordinates: ImageOverlayCoordinates;
  }): void;
  addLayer(layer: {
    id: string;
    type: 'raster';
    source: string;
    paint: {
      'raster-opacity': number;
      'raster-fade-duration': number;
    };
  }): void;
  setLayoutProperty?(layer: string, name: string, value: string): void;
  getSource(id: string): { setCoordinates(coordinates: ImageOverlayCoordinates): void } | undefined;
  fitBounds(bounds: unknown, options: { padding: number; animate: boolean }): void;
  zoomIn?(options: { duration: number }): void;
  zoomOut?(options: { duration: number }): void;
}

export interface MapGlMarkerLike extends ImageAlignmentMarker {
  setLngLat(position: [number, number]): MapGlMarkerLike;
  addTo(map: MapGlAlignmentMapLike): ImageAlignmentMarker;
}

export type MapGlMarkerConstructor = new (options: {
  element: HTMLElement;
  draggable: true;
  anchor: 'center';
}) => MapGlMarkerLike;

export type MapGlBoundsConstructor = new () => {
  extend(position: [number, number]): void;
};

export function createMapGlImageAlignmentMap(map: MapGlAlignmentMapLike, MarkerCtor: MapGlMarkerConstructor, BoundsCtor: MapGlBoundsConstructor): ImageAlignmentMap {
  let imageSource: { setCoordinates(coordinates: ImageOverlayCoordinates): void } | undefined;

  return {
    on: (type, handler) => map.on(type, handler),
    resize: () => map.resize(),
    remove: () => map.remove(),
    getCanvas: () => map.getCanvas(),
    project: (point) => map.project(point),
    unproject: (point) => {
      const lngLat = map.unproject(point);

      return { lat: lngLat.lat, lng: lngLat.lng };
    },
    addImageOverlay: (imageUrl, coordinates, opacity) => {
      map.addSource('overlay-image', {
        type: 'image',
        url: imageUrl,
        coordinates
      });
      map.addLayer({
        id: 'overlay-layer',
        type: 'raster',
        source: 'overlay-image',
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 0
        }
      });
      imageSource = map.getSource('overlay-image');
    },
    updateImageOverlay: (coordinates) => imageSource?.setCoordinates(coordinates),
    setImageVisible: (visible) => map.setLayoutProperty?.('overlay-layer', 'visibility', visible ? 'visible' : 'none'),
    createMarker: (position, element) => new MarkerCtor({
      element,
      draggable: true,
      anchor: 'center'
    })
      .setLngLat([position.lng, position.lat])
      .addTo(map),
    fitBounds: (corners) => {
      const bounds = new BoundsCtor();

      bounds.extend([corners.nw.lng, corners.nw.lat]);
      bounds.extend([corners.ne.lng, corners.ne.lat]);
      bounds.extend([corners.se.lng, corners.se.lat]);
      bounds.extend([corners.sw.lng, corners.sw.lat]);
      map.fitBounds(bounds, { padding: 50, animate: false });
    },
    zoomIn: () => map.zoomIn?.({ duration: 0 }),
    zoomOut: () => map.zoomOut?.({ duration: 0 })
  };
}

const MARKER_COLORS = {
  nw: '#FF0000',
  ne: '#00FF00',
  se: '#0000FF',
  sw: '#FFFF00'
} as const;

const ROTATE_CURSOR_PATH = 'M26 12A10 10 0 0 0 8 8L5 11M5 5v6h6M6 20a10 10 0 0 0 18 4l3-3M27 27v-6h-6';
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${ROTATE_CURSOR_PATH}" stroke="white" stroke-width="5"/><path d="${ROTATE_CURSOR_PATH}" stroke="black" stroke-width="2.5"/></g></svg>`
)}") 16 16, crosshair`;

export class ImageOverlayAlignmentRunner {
  constructor(private app: App, private adapter: ImageOverlayAlignmentAdapter) {}

  process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    const container = el.createDiv({ cls: "places-overlay-alignment-container" });
    const ownerWindow = container.ownerDocument.defaultView ?? activeWindow;
    const settings = parseImageOverlayAlignmentSettings(source);

    const renderChild = new MarkdownRenderChild(container);

    ctx.addChild(renderChild);
    let disposed = false;

    renderChild.register(() => { disposed = true; });

    if (!settings.image) {
      renderError(container, {
        icon: "🖼️",
        title: "No Image Specified",
        message: 'Use overlays with path plus bounds or corners.',
        className: "image-align-error"
      });

      return;
    }

    const imagePath = settings.image;
    const sectionInfo = ctx.getSectionInfo(el);
    const sessionKey = imageOverlayAlignmentSessionKey({
      path: ctx.sourcePath,
      lineStart: sectionInfo?.lineStart,
    }, imagePath);

    const sessionSources = sharedRegistryMap<string, string>(Symbol.for('places.map.image-alignment-session-sources'));

    if (sessionSources.has(sessionKey) && sessionSources.get(sessionKey) !== source) {
      getImageOverlayAlignmentSessionRegistry().delete(sessionKey);
    }

    sessionSources.set(sessionKey, source);

    if (this.adapter.missingConfiguration) {
      renderError(container, {
        icon: "🔑",
        title: this.adapter.missingConfiguration.title,
        message: this.adapter.missingConfiguration.message,
        className: "image-align-error"
      });

      return;
    }

    const mapContainer = container.createDiv({ cls: "places-overlay-alignment-map" });

    mapContainer.setCssProps({
      height: settings.height || "500px",
      width: "100%"
    });

    const coordsContainer = container.createDiv({ cls: "places-overlay-alignment-coords" });
    const coordsOutput = coordsContainer.createEl("pre");

    coordsOutput.setCssProps({
      backgroundColor: "var(--background-secondary)",
      padding: "10px",
      borderRadius: "4px",
      fontSize: "12px",
      fontFamily: "monospace",
      overflowX: "auto",
      marginBottom: "10px"
    });

    let activeMap: ImageAlignmentMap | null = null;

    void this.loadImageResource(imagePath).then((resource) => {
      if (disposed) {
        resource.revoke?.();

        return;
      }

      const imageUrl = resource.url;
      const map = this.adapter.createMap(mapContainer, settings);

      activeMap = map;
      const resizeObserver = new ResizeObserver(() => map.resize());

      resizeObserver.observe(mapContainer);
      renderChild.register(() => {
        if (activeMap === map) {
          map.remove();
          activeMap = null;
        }
      });
      renderChild.register(() => resizeObserver.disconnect());
      if (resource.revoke) renderChild.register(resource.revoke);

      const stopTouchPropagation = (event: TouchEvent) => event.stopPropagation();

      renderChild.registerDomEvent(mapContainer, 'touchstart', stopTouchPropagation, { passive: true });
      renderChild.registerDomEvent(mapContainer, 'touchmove', stopTouchPropagation, { passive: true });
      renderChild.registerDomEvent(mapContainer, 'touchend', stopTouchPropagation, { passive: true });

      const pointSession = getPointAlignmentSession(sessionKey, source);
      const positionedCorners = pointSession?.corners ?? getImageOverlayAlignmentSessionCorners(sessionKey) ?? settings.initialCorners;
      const hasPositionedCorners = !!positionedCorners;
      const corners: ImageOverlayAlignmentCorners = positionedCorners
        ? cloneImageOverlayAlignmentCorners(positionedCorners)
        : { nw: { lat: 0, lng: 0 }, ne: { lat: 0, lng: 0 }, se: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } };

      const markers: Partial<Record<keyof ImageOverlayAlignmentCorners, ImageAlignmentMarker>> = {};
      let updateScheduled = false;
      let lastCoordsUpdate = 0;
      let isDraggingImage = false;
      let pointEditor: ImageAlignmentPointEditor | undefined;
      let dragStartPoint: ImageOverlayAlignmentCorner | null = null;
      const updateOutput = (alignmentYaml = pointEditor?.isMatching ? pointEditor.getAlignmentYaml() : undefined) => {
        coordsOutput.textContent = alignmentYaml ?? formatImageOverlayAlignmentOutput(imagePath, corners);
      };

      const setMarkersToCorners = () => {
        markers.nw?.setLngLat([corners.nw.lng, corners.nw.lat]);
        markers.ne?.setLngLat([corners.ne.lng, corners.ne.lat]);
        markers.se?.setLngLat([corners.se.lng, corners.se.lat]);
        markers.sw?.setLngLat([corners.sw.lng, corners.sw.lat]);
      };

      const updateImageOverlay = (immediate = false) => {
        const doUpdate = () => {
          if (disposed) return;
          map.updateImageOverlay(cornersToCoordinates(corners));
          setImageOverlayAlignmentSessionCorners(sessionKey, corners);

          const now = Date.now();

          if (immediate || now - lastCoordsUpdate > 150) {
            updateOutput();
            lastCoordsUpdate = now;
          }

          updateScheduled = false;
        };

        if (immediate) {
          doUpdate();
        } else if (!updateScheduled) {
          updateScheduled = true;
          window.requestAnimationFrame(doUpdate);
        }
      };

      map.on('load', () => {
        if (disposed) return;
        const startingCorners = settings.initialCorners
          ? cloneImageOverlayAlignmentCorners(settings.initialCorners)
          : computeCenteredCorners(map, resource.aspectRatio);

        if (!hasPositionedCorners) {
          Object.assign(corners, cloneImageOverlayAlignmentCorners(startingCorners));
          setImageOverlayAlignmentSessionCorners(sessionKey, corners);
        }

        map.addImageOverlay(imageUrl, cornersToCoordinates(corners), settings.opacity ?? 1.0);
        updateOutput();

        if (settings.referenceOverlays?.length) {
          const showReferenceError = (message: string) => {
            if (!disposed) renderMapSupplementalError(mapContainer, {
              title: 'Could not load reference overlay', message,
            });
          };

          if (map.addReferenceOverlays) {
            void map.addReferenceOverlays(settings.referenceOverlays, ctx.sourcePath)
              .then(errors => {
                for (const error of errors) showReferenceError(`${error.path}: ${error.error}`);
              })
              .catch(error => showReferenceError(getErrorMessage(error)));
          } else {
            showReferenceError('This provider does not support reference overlays.');
          }
        }

        let shiftHeld = false;
        let altHeld = false;
        const canvas = map.getCanvas();
        const markerElements: HTMLElement[] = [];
        let isOverImage = false;
        let isDraggingMarker = false;
        let dragMode: 'move' | 'scale' | 'rotate' | null = null;
        const updateCursor = () => {
          if (pointEditor?.isMatching) { canvas.setCssProps({ cursor: '' });

 return; }

          const modifierCursor = shiftHeld ? 'nwse-resize' : altHeld ? ROTATE_CURSOR : 'grab';
          const imageCursor = isDraggingImage
            ? dragMode === 'scale' ? 'nwse-resize' : dragMode === 'rotate' ? ROTATE_CURSOR : 'move'
            : isOverImage || isDraggingMarker ? modifierCursor : '';

          canvas.setCssProps({ cursor: imageCursor });

          for (const element of markerElements) {
            element.setCssProps({ cursor: shiftHeld ? 'nwse-resize' : altHeld ? ROTATE_CURSOR : 'move' });
          }
        };
        const trackModifiers = (event: KeyboardEvent) => {
          shiftHeld = event.shiftKey;
          altHeld = event.altKey;
          updateCursor();
        };

        renderChild.registerDomEvent(ownerWindow, 'keydown', trackModifiers, true);
        renderChild.registerDomEvent(ownerWindow, 'keyup', trackModifiers, true);

        let markerDragRef: { dist: number; angle: number } | null = null;

        for (const corner of Object.keys(MARKER_COLORS) as Array<keyof ImageOverlayAlignmentCorners>) {
          const markerElement = createCornerMarkerElement(MARKER_COLORS[corner]);

          markerElements.push(markerElement);
          const marker = map.createMarker(corners[corner], markerElement);

          marker.on('drag', () => {
            if (pointEditor?.isMatching) return;
            isDraggingMarker = true;
            updateCursor();
            const lngLat = marker.getLngLat();
            const point = { lat: lngLat.lat, lng: lngLat.lng };

            if (shiftHeld) {
              const dist = distanceFromCenter(corners, point) || 1;

              if (!markerDragRef) {
                markerDragRef = { dist, angle: 0 };
              } else {
                if (markerDragRef.dist > 0) scaleCorners(corners, dist / markerDragRef.dist);
                markerDragRef.dist = dist;
              }

              setMarkersToCorners();
            } else if (altHeld) {
              const angle = angleFromCenter(corners, point);

              if (!markerDragRef) {
                markerDragRef = { dist: 0, angle };
              } else {
                rotateCorners(corners, angle - markerDragRef.angle);
                markerDragRef.angle = angle;
              }

              setMarkersToCorners();
            } else {
              corners[corner] = point;
            }

            updateImageOverlay();
          });
          marker.on('dragend', () => {
            isDraggingMarker = false;
            updateCursor();
            markerDragRef = null;
            updateImageOverlay(true);
            pointEditor?.manualChanged();
          });
          markers[corner] = marker;
        }

        if (hasPositionedCorners) {
          map.fitBounds(corners);
        }

        const buttonContainer = mapContainer.createDiv('places-overlay-alignment-buttons');
        const resetCorners = (next: ImageOverlayAlignmentCorners) => {
          isDraggingImage = false;
          isDraggingMarker = false;
          dragMode = null;
          dragStartPoint = null;
          markerDragRef = null;
          Object.assign(corners, next);
          setMarkersToCorners();
          updateImageOverlay(true);
          updateCursor();
        };

        this.addButton(buttonContainer, 'Reset shape', 'rectangle-horizontal', () => {
          resetCorners(rectifyImageOverlayCorners(map, corners, resource.aspectRatio));
          pointEditor?.manualChanged();
        });
        this.addButton(buttonContainer, 'Reset alignment', 'rotate-ccw', () => {
          resetCorners(cloneImageOverlayAlignmentCorners(startingCorners));
          pointEditor?.manualChanged();
          map.fitBounds(corners);
        });

        if (settings.referenceOverlays?.length) {
          this.addButton(buttonContainer, 'View track', 'scan', () => pointEditor?.viewTrack());
        }

        if (this.adapter.showZoomButtons) {
          this.addButton(buttonContainer, 'Zoom in', 'plus', () => map.zoomIn?.());
          this.addButton(buttonContainer, 'Zoom out', 'minus', () => map.zoomOut?.());
        }

        this.addButton(buttonContainer, 'Copy alignment YAML', 'clipboard', () => {
          void copyToClipboard(pointEditor?.getAlignmentYaml() ?? coordsOutput.textContent ?? '', 'Alignment YAML copied');
        });

        const isPointerOverImage = (lngLat: ImageOverlayAlignmentCorner) => {
          const inside = pointInPolygon(
            [lngLat.lng, lngLat.lat],
            [
              [corners.nw.lng, corners.nw.lat],
              [corners.ne.lng, corners.ne.lat],
              [corners.se.lng, corners.se.lat],
              [corners.sw.lng, corners.sw.lat]
            ]
          );

          isOverImage = inside;

          return inside;
        };

        let lastScaleDist = 0;
        let lastRotateAngle = 0;

        map.on('mousedown', (event) => {
          if (pointEditor?.isMatching) return;
          shiftHeld = event.originalEvent.shiftKey;
          altHeld = event.originalEvent.altKey;
          updateCursor();
          if (event.defaultPrevented) return;
          if (!isPointerOverImage(event.lngLat)) return;

          event.preventDefault();
          isDraggingImage = true;
          const point = event.lngLat;

          if (event.originalEvent.shiftKey) {
            dragMode = 'scale';
            lastScaleDist = distanceFromCenter(corners, point) || 1;
          } else if (event.originalEvent.altKey) {
            dragMode = 'rotate';
            lastRotateAngle = angleFromCenter(corners, point);
          } else {
            dragMode = 'move';
            dragStartPoint = point;
          }

          updateCursor();
        });

        map.on('mousemove', (event) => {
          if (pointEditor?.isMatching) return;
          shiftHeld = event.originalEvent.shiftKey;
          altHeld = event.originalEvent.altKey;
          const point = event.lngLat;

          if (!isDraggingImage || !dragMode) {
            isPointerOverImage(point);
            updateCursor();

            return;
          }

          if (dragMode === 'move' && dragStartPoint) {
            translateCorners(corners, point.lng - dragStartPoint.lng, point.lat - dragStartPoint.lat);
            dragStartPoint = point;
          } else if (dragMode === 'scale') {
            const dist = distanceFromCenter(corners, point);

            if (dist > 0 && lastScaleDist > 0) scaleCorners(corners, dist / lastScaleDist);
            lastScaleDist = dist || lastScaleDist;
          } else if (dragMode === 'rotate') {
            const angle = angleFromCenter(corners, point);

            rotateCorners(corners, angle - lastRotateAngle);
            lastRotateAngle = angle;
          }

          setMarkersToCorners();
          updateImageOverlay();
        });

        const endImageDrag = () => {
          if (!isDraggingImage) return;

          isDraggingImage = false;
          dragMode = null;
          dragStartPoint = null;
          updateCursor();
          updateImageOverlay(true);
          pointEditor?.manualChanged();
        };

        renderChild.registerDomEvent(container.ownerDocument, 'mouseup', endImageDrag);
        renderChild.registerDomEvent(ownerWindow, 'blur', () => {
          shiftHeld = false;
          altHeld = false;
          isDraggingMarker = false;
          isOverImage = false;
          endImageDrag();
          updateCursor();
        });
        renderChild.registerDomEvent(mapContainer, 'mouseleave', () => {
          isOverImage = false;
          updateCursor();
        });

        map.on('wheel', (event) => {
          if (pointEditor?.isMatching) return;
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.offsetWidth > 0 ? rect.width / canvas.offsetWidth : 1;
          const scaleY = canvas.offsetHeight > 0 ? rect.height / canvas.offsetHeight : 1;
          const point = map.unproject([
            (event.originalEvent.clientX - rect.left) / scaleX - canvas.clientLeft,
            (event.originalEvent.clientY - rect.top) / scaleY - canvas.clientTop,
          ]);

          if (!isPointerOverImage(point)) return;

          event.preventDefault();
          event.originalEvent.preventDefault();
          event.originalEvent.stopPropagation();

          scaleCorners(corners, -event.originalEvent.deltaY > 0 ? 1.05 : 0.95);
          setMarkersToCorners();
          updateImageOverlay(true);
          pointEditor?.manualChanged();
        });

        container.setAttribute('tabindex', '0');
        container.setCssProps({ outline: 'none' });

        const handleKeydown = (event: KeyboardEvent) => {
          if (pointEditor?.isMatching || (event.target as HTMLElement)?.closest('input, select, textarea, button')) return;
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;

          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const step = event.shiftKey ? 0.0001 : 0.00001;
          const delta = getArrowKeyDelta(event.key, step);

          translateCorners(corners, delta.lng, delta.lat);
          setMarkersToCorners();
          updateImageOverlay(true);
          pointEditor?.manualChanged();
        };

        renderChild.registerDomEvent(container, 'keydown', handleKeydown);

        pointEditor = new ImageAlignmentPointEditor({
          container, mapContainer, map, imageUrl, width: resource.width, height: resource.height, source, sessionKey,
          alignment: settings.alignment ?? { fit: 'similarity', points: [] },
          formatDistance: this.adapter.formatDistance,
          onOutputChange: updateOutput,
          getCorners: () => corners, applyCorners: resetCorners,
          onModeChange: matching => {
            endImageDrag();
            for (const element of markerElements) element.setCssProps({ display: matching ? 'none' : '' });
            for (const marker of Object.values(markers)) marker?.setDraggable?.(!matching);
            canvas.setCssProps({ cursor: '' });
          },
        });
        renderChild.register(() => pointEditor?.destroy());
      });
    }).catch((error) => {
      if (disposed) return;
      activeMap?.remove();
      activeMap = null;
      coordsContainer.remove();
      renderMapSurfaceError(mapContainer, {
        icon: "⚠️",
        title: "Error Loading Overlay",
        message: getErrorMessage(error),
        className: "image-align-error"
      });
    });
  }

  private async loadImageResource(path: string): Promise<{ url: string; aspectRatio: number; width: number; height: number; revoke?: () => void }> {
    let url: string;
    let revoke: (() => void) | undefined;

    if (path.startsWith('http://') || path.startsWith('https://')) {
      const response = await requestUrl({ url: path });
      const contentType = response.headers?.['content-type'] || response.headers?.['Content-Type'] || 'image/*';
      const blob = new Blob([response.arrayBuffer], { type: contentType });

      url = URL.createObjectURL(blob);
      revoke = () => URL.revokeObjectURL(url);
    } else if (path.startsWith('data:')) {
      url = path;
    } else {
      const file = this.app.vault.getAbstractFileByPath(normalizePath(path));

      if (!file) throw new Error(`Image file not found in vault: ${path}`);
      if (!(file instanceof TFile)) throw new Error(`Path is not a file: ${path}`);
      url = this.app.vault.getResourcePath(file);
    }

    const dimensions = await loadImageDimensions(url).catch((error: unknown) => {
      revoke?.();

      throw error;
    });

    return { url, ...dimensions, revoke };
  }

  private addButton(container: HTMLElement, label: string, icon: string, onClick: () => void): void {
    const button = container.createEl('button', { cls: 'places-floating-button', attr: { type: 'button', 'aria-label': label, title: label } });

    setIcon(button, icon);
    button.addEventListener('click', onClick);
  }
}

export function rectifyImageOverlayCorners(map: Pick<ImageAlignmentMap, 'project' | 'unproject'>, corners: ImageOverlayAlignmentCorners, aspectRatio: number): ImageOverlayAlignmentCorners {
  const points = [corners.nw, corners.ne, corners.se, corners.sw].map(point => map.project(point));
  const cx = points.reduce((sum, point) => sum + point.x, 0) / 4;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / 4;
  const width = (Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
    + Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y)) / 2 || 100;
  const height = width / (Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1);

  return {
    nw: map.unproject([cx - width / 2, cy - height / 2]),
    ne: map.unproject([cx + width / 2, cy - height / 2]),
    se: map.unproject([cx + width / 2, cy + height / 2]),
    sw: map.unproject([cx - width / 2, cy + height / 2]),
  };
}

function cloneImageOverlayAlignmentCorners(corners: ImageOverlayAlignmentCorners): ImageOverlayAlignmentCorners {
  return {
    nw: { ...corners.nw },
    ne: { ...corners.ne },
    se: { ...corners.se },
    sw: { ...corners.sw },
  };
}

function getImageOverlayAlignmentSessionRegistry(): ImageOverlayAlignmentSessionRegistry {
  return sharedRegistryMap<string, ImageOverlayAlignmentCorners>(ALIGNMENT_SESSION_REGISTRY_KEY);
}

function loadImageDimensions(url: string): Promise<{ aspectRatio: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve({
      aspectRatio: img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1,
      width: img.naturalWidth, height: img.naturalHeight,
    });
    img.onerror = () => reject(new Error('Could not load image to measure its dimensions'));
    img.src = url;
  });
}

function computeCenteredCorners(map: ImageAlignmentMap, aspectRatio: number): ImageOverlayAlignmentCorners {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth || canvas.width || 800;
  const height = canvas.clientHeight || canvas.height || 500;

  let rectW = width * 0.5;
  let rectH = rectW / (aspectRatio || 1);

  if (rectH > height * 0.7) {
    rectH = height * 0.7;
    rectW = rectH * (aspectRatio || 1);
  }

  const cx = width / 2;
  const cy = height / 2;

  return {
    nw: map.unproject([cx - rectW / 2, cy - rectH / 2]),
    ne: map.unproject([cx + rectW / 2, cy - rectH / 2]),
    se: map.unproject([cx + rectW / 2, cy + rectH / 2]),
    sw: map.unproject([cx - rectW / 2, cy + rectH / 2]),
  };
}

export function parseImageOverlayAlignmentSettings(source: string): ImageOverlayAlignmentSettings {
  const parsed = parseCodeBlockYaml(source);
  const settings: ImageOverlayAlignmentSettings = {};

  const overlayValue = parsed.overlays;

  if (overlayValue !== undefined) {
    const entries: unknown[] = Array.isArray(overlayValue) ? overlayValue : [overlayValue];

    if (!Array.isArray(overlayValue) && !isRecord(overlayValue)) throw new Error('overlays must be a mapping or a list of mappings.');
    const images = entries.filter((entry): entry is Record<string, unknown> => isRecord(entry) && isImageOverlayDefinition(entry));

    if (images.length !== 1) throw new Error('Image alignment requires exactly one image entry in overlays. Use an image path, or type: image with a path. Other entries can be reference tracks or notes.');
    const overlay = readImageOverlayDefinition(images[0]);

    settings.alignment = parseControlPointAlignment(images[0].alignment);
    const references = entries.filter(entry => entry !== images[0]);

    if (references.length) settings.referenceOverlays = references;

    if (overlay.path) {
      settings.image = overlay.path;

      if (overlay.corners) {
        settings.initialCorners = requireImageOverlayCoordinates(overlay.corners, 'corners');
      } else if (overlay.bounds) {
        settings.initialCorners = requireImageOverlayCoordinates(overlay.bounds, 'bounds');
      }

      if (overlay.opacity !== undefined) {
        settings.opacity = overlay.opacity;
      }
    }
  }

  if (typeof parsed.height === 'string' || typeof parsed.height === 'number') settings.height = String(parsed.height);
  if (typeof parsed.style === 'string') settings.style = parsed.style;
  if (typeof parsed.initialZoom === 'number') settings.initialZoom = parsed.initialZoom;

  if (typeof parsed.initialCenter === 'string') {
    const coordinate = parseCoordinate(parsed.initialCenter);

    if (coordinate) settings.initialCenter = [coordinate.longitude, coordinate.latitude];
  }

  return settings;
}

function readImageOverlayDefinition(entry: Record<string, unknown>): { path?: string; bounds?: string; corners?: string; opacity?: number } {
  const result: { path?: string; bounds?: string; corners?: string; opacity?: number } = {};

  if (typeof entry.path === 'string') result.path = entry.path;
  if (typeof entry.bounds === 'string') result.bounds = entry.bounds;
  if (typeof entry.corners === 'string') result.corners = entry.corners;
  if (typeof entry.opacity === 'number') result.opacity = entry.opacity;

  if (!result.path) {
    throw new Error('The image entry requires a text path.');
  }

  return result;
}

export function parseImageOverlayCoordinates(value: string): ImageOverlayAlignmentCorners | undefined {
  const coords = value.split(',').map(v => parseFloat(v.trim()));

  if (coords.length === 4 && coords.every(c => !isNaN(c))) {
    let [swLat, swLng, neLat, neLng] = coords;

    if (swLat > neLat) [swLat, neLat] = [neLat, swLat];
    if (swLng > neLng) [swLng, neLng] = [neLng, swLng];

    return {
      nw: { lat: neLat, lng: swLng },
      ne: { lat: neLat, lng: neLng },
      se: { lat: swLat, lng: neLng },
      sw: { lat: swLat, lng: swLng }
    };
  }

  if (coords.length === 8 && coords.every(c => !isNaN(c))) {
    const corners = {
      nw: { lat: coords[0], lng: coords[1] },
      ne: { lat: coords[2], lng: coords[3] },
      se: { lat: coords[4], lng: coords[5] },
      sw: { lat: coords[6], lng: coords[7] }
    };
    const legacy = { ...corners, se: corners.sw, sw: corners.se };

    return imageEdgesCross(corners) && !imageEdgesCross(legacy) ? legacy : corners;
  }

  return undefined;
}

function imageEdgesCross(corners: ImageOverlayAlignmentCorners): boolean {
  const cross = (a: ImageOverlayAlignmentCorner, b: ImageOverlayAlignmentCorner, c: ImageOverlayAlignmentCorner) =>
    (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  const intersect = (a: ImageOverlayAlignmentCorner, b: ImageOverlayAlignmentCorner, c: ImageOverlayAlignmentCorner, d: ImageOverlayAlignmentCorner) =>
    cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;

  return intersect(corners.nw, corners.ne, corners.se, corners.sw)
    || intersect(corners.ne, corners.se, corners.sw, corners.nw);
}

function requireImageOverlayCoordinates(value: string, key: 'bounds' | 'corners'): ImageOverlayAlignmentCorners {
  const coordinates = parseImageOverlayCoordinates(value);

  if (!coordinates) {
    const expected = key === 'bounds' ? 4 : 8;

    throw new Error(`${key} requires ${expected} comma-separated numeric coordinates.`);
  }

  return coordinates;
}

export function formatImageOverlayAlignmentOutput(image: string, corners: ImageOverlayAlignmentCorners): string {
  const format = (n: number) => n.toFixed(6);
  const cornersStr = `${format(corners.nw.lat)},${format(corners.nw.lng)},${format(corners.ne.lat)},${format(corners.ne.lng)},${format(corners.se.lat)},${format(corners.se.lng)},${format(corners.sw.lat)},${format(corners.sw.lng)}`;
  let output = [
    'overlays:',
    `  - path: ${JSON.stringify(image)}`,
    `    corners: ${cornersStr}`,
  ].join('\n');

  const isAxisAligned =
    Math.abs(corners.nw.lat - corners.ne.lat) < 0.000001 &&
    Math.abs(corners.sw.lat - corners.se.lat) < 0.000001 &&
    Math.abs(corners.nw.lng - corners.sw.lng) < 0.000001 &&
    Math.abs(corners.ne.lng - corners.se.lng) < 0.000001;
  const hasValidWidth = Math.hypot(corners.ne.lng - corners.nw.lng, corners.ne.lat - corners.nw.lat) > 0.00001;
  const hasValidHeight = Math.hypot(corners.nw.lng - corners.sw.lng, corners.nw.lat - corners.sw.lat) > 0.00001;
  const isValidShape = hasValidWidth && hasValidHeight;

  if (isAxisAligned && isValidShape) {
    const boundsStr = `${format(corners.sw.lat)},${format(corners.sw.lng)},${format(corners.ne.lat)},${format(corners.ne.lng)}`;

    output += [
      '',
      '',
      'overlays:',
      `  - path: ${JSON.stringify(image)}`,
      `    bounds: ${boundsStr}`,
    ].join('\n');
  }

  if (!isValidShape) {
    output += '\n\n⚠️ Warning: Image has near-zero ';

    if (!hasValidWidth && !hasValidHeight) {
      output += 'width and height';
    } else if (!hasValidWidth) {
      output += 'width';
    } else {
      output += 'height';
    }

    output += '. Drag corner markers to create a valid shape.';
  }

  return output;
}

export function cornersToCoordinates(corners: ImageOverlayAlignmentCorners): ImageOverlayCoordinates {
  return [
    [corners.nw.lng, corners.nw.lat],
    [corners.ne.lng, corners.ne.lat],
    [corners.se.lng, corners.se.lat],
    [corners.sw.lng, corners.sw.lat]
  ];
}

function createCornerMarkerElement(color: string): HTMLElement {
  const el = createDiv();

  el.setCssProps({
    width: '20px',
    height: '20px',
    backgroundColor: color,
    border: '2px solid white',
    borderRadius: '50%',
    cursor: 'move',
    touchAction: 'none',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    transition: 'none'
  });

  return el;
}

function pointInPolygon(point: number[], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

function translateCorners(corners: ImageOverlayAlignmentCorners, deltaLng: number, deltaLat: number): void {
  for (const corner of Object.values(corners)) {
    corner.lng += deltaLng;
    corner.lat += deltaLat;
  }
}

function getCornersCenter(corners: ImageOverlayAlignmentCorners): ImageOverlayAlignmentCorner {
  return {
    lng: (corners.nw.lng + corners.ne.lng + corners.se.lng + corners.sw.lng) / 4,
    lat: (corners.nw.lat + corners.ne.lat + corners.se.lat + corners.sw.lat) / 4,
  };
}

function scaleCorners(corners: ImageOverlayAlignmentCorners, scaleFactor: number): void {
  const center = getCornersCenter(corners);

  for (const corner of Object.values(corners)) {
    corner.lng = center.lng + (corner.lng - center.lng) * scaleFactor;
    corner.lat = center.lat + (corner.lat - center.lat) * scaleFactor;
  }
}

function rotateCorners(corners: ImageOverlayAlignmentCorners, angleRad: number): void {
  const center = getCornersCenter(corners);
  const lngScale = Math.cos(center.lat * DEG_TO_RAD) || 1;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  for (const corner of Object.values(corners)) {
    const dx = (corner.lng - center.lng) * lngScale;
    const dy = corner.lat - center.lat;

    corner.lng = center.lng + (dx * cos - dy * sin) / lngScale;
    corner.lat = center.lat + (dx * sin + dy * cos);
  }
}

function angleFromCenter(corners: ImageOverlayAlignmentCorners, point: ImageOverlayAlignmentCorner): number {
  const center = getCornersCenter(corners);
  const lngScale = Math.cos(center.lat * DEG_TO_RAD) || 1;

  return Math.atan2(point.lat - center.lat, (point.lng - center.lng) * lngScale);
}

function distanceFromCenter(corners: ImageOverlayAlignmentCorners, point: ImageOverlayAlignmentCorner): number {
  const center = getCornersCenter(corners);
  const lngScale = Math.cos(center.lat * DEG_TO_RAD) || 1;
  const dx = (point.lng - center.lng) * lngScale;
  const dy = point.lat - center.lat;

  return Math.hypot(dx, dy);
}

function getArrowKeyDelta(key: string, step: number): ImageOverlayAlignmentCorner {
  switch (key) {
    case 'ArrowUp':
      return { lng: 0, lat: step };
    case 'ArrowDown':
      return { lng: 0, lat: -step };
    case 'ArrowLeft':
      return { lng: -step, lat: 0 };
    case 'ArrowRight':
      return { lng: step, lat: 0 };
    default:
      return { lng: 0, lat: 0 };
  }
}
