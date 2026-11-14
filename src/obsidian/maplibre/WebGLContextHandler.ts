import { logger, renderMapSurfaceError } from "../../utils/index";
import { cleanupMapProviderStates } from "../../map/index";
import { getMapRecoveryState, markMapContextRestored } from "../map/index";

const CONTEXT_RESTORE_GRACE_MS = 3000;

export function showWebGLContextLostMessage(container: HTMLElement, onRetry?: () => void): void {
  const existingOverlay = container.querySelector('.places-webgl-error-overlay');

  if (existingOverlay) {
    return;
  }

  const retry = onRetry ?? getMapRecoveryState(container)?.rehydrate;

  cleanupMapProviderStates(container, error => logger.error('Failed to clean up map after WebGL context loss:', error));

  const host = container.parentElement;

  host?.querySelectorAll(':scope > .places-floating-buttons, :scope > .places-geocoding-search')
    .forEach(element => element.remove());

  container.addClass('places-map-context-lost');
  const errorPanel = renderMapSurfaceError(container, {
    icon: '⚠️',
    title: 'Map display error',
    message: 'The map lost its graphics context. Use refresh or reopen the view after resources are available.',
    className: 'webgl-error-overlay',
  });

  if (retry) {
    const actions = errorPanel.createDiv({ cls: 'places-webgl-error-actions' });
    const retryBtn = actions.createEl('button', { text: 'Retry', cls: 'mod-cta' });

    retryBtn.addEventListener('click', () => void (async () => {
      retryBtn.toggleClass('is-loading', true);
      retryBtn.setAttr('disabled', 'true');

      try {
        await Promise.resolve(retry());
        container.removeClass('places-map-context-lost');
        errorPanel.remove();
      } catch (error) {
        retryBtn.toggleClass('is-loading', false);
        retryBtn.removeAttribute('disabled');
        logger.error('Failed to retry map after WebGL context loss:', error);
      }
    })());
  }
}

export interface WebGLContextLostMap {
  on(type: 'webglcontextlost' | 'webglcontextrestored', handler: () => void): void;
}

export interface WebGLContextLossOptions {
  onPermanentLoss?: () => void;
  onRetry?: () => void;
}

export interface WebGLContextLossHandle {
  dispose(): void;
}

export function handleWebGLContextLost(map: WebGLContextLostMap, container: HTMLElement, options: WebGLContextLossOptions = {}): WebGLContextLossHandle {
  let restored = true;
  let disposed = false;
  let pendingTeardown: number | null = null;

  const clearPendingTeardown = () => {
    if (pendingTeardown === null) return;
    window.clearTimeout(pendingTeardown);
    pendingTeardown = null;
  };

  map.on('webglcontextrestored', () => {
    if (disposed) return;
    restored = true;
    clearPendingTeardown();
    markMapContextRestored(container);
    logger.debug('WebGL context restored');
  });

  map.on('webglcontextlost', () => {
    if (disposed) return;
    restored = false;
    logger.warn('WebGL context lost - waiting for automatic restore (memory pressure or too many map instances)');
    if (pendingTeardown !== null) return;
    pendingTeardown = window.setTimeout(() => {
      pendingTeardown = null;
      if (disposed || restored || !container.isConnected) return;
      options.onPermanentLoss?.();
      showWebGLContextLostMessage(container, options.onRetry);
    }, CONTEXT_RESTORE_GRACE_MS);
  });

  return {
    dispose: () => {
      disposed = true;
      clearPendingTeardown();
    },
  };
}
