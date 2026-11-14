export interface MapTouchHandlerOptions {
  mapContainer: HTMLElement;
}

export function setupMapTouchHandlers(options: MapTouchHandlerOptions): () => void {
  const element = options.mapContainer;
  const ownerDocument = element.ownerDocument;
  const controller = new AbortController();
  const signal = controller.signal;

  element.setCssProps({ touchAction: 'pan-x pan-y pinch-zoom' });

  const scrollContainerSelectors = '.markdown-preview-view, .markdown-source-view, .cm-scroller, .view-content';
  let savedScrollTop = 0;
  let savedScrollLeft = 0;
  let isInteracting = false;

  const scrollContainer = element.closest(scrollContainerSelectors);

  element.addEventListener('mousedown', () => {
    if (scrollContainer) {
      savedScrollTop = scrollContainer.scrollTop;
      savedScrollLeft = scrollContainer.scrollLeft;
      isInteracting = true;
    }
  }, { capture: true, signal });

  ownerDocument.addEventListener('mouseup', () => {
    window.setTimeout(() => { isInteracting = false; }, 100);
  }, { capture: true, signal });

  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
      if (isInteracting) {
        scrollContainer.scrollTop = savedScrollTop;
        scrollContainer.scrollLeft = savedScrollLeft;
      }
    }, { passive: true, signal });
  }

  element.addEventListener('focusin', () => {
    if (scrollContainer && isInteracting) {
      queueMicrotask(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop = savedScrollTop;
          scrollContainer.scrollLeft = savedScrollLeft;
        }
      });
    }
  }, { capture: true, signal });

  element.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
    }
  }, { passive: true, signal });

  return () => controller.abort();
}
