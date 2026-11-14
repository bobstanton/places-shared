import * as _placesDom from '../utils';
import { setIcon } from '../services/index';
import { sleep } from '../utils/index';

const MIN_BUSY_MS = 1000;

export interface FloatingRefreshButtonOptions {
  buttonContainer: HTMLElement;
  ariaLabel: string;
  className?: string;
  onRefresh: () => Promise<unknown>;
  onError?: (error: unknown) => void;
  progressHost?: HTMLElement;
  registerActions?: (container: HTMLElement) => void;
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => window.setTimeout(resolve, 0)));
}

export function createFloatingRefreshButton(options: FloatingRefreshButtonOptions): HTMLElement {
  const refreshButton = _placesDom.createDiv(options.buttonContainer, options.className ?? 'places-floating-button');

  refreshButton.setAttribute('aria-label', options.ariaLabel);
  setIcon(refreshButton, 'refresh-cw');

  let busy = false;

  const setBusy = (value: boolean): void => {
    busy = value;
    _placesDom.toggleClass(options.buttonContainer, 'places-floating-buttons-active', value);
    _placesDom.toggleClass(refreshButton, 'is-loading', value);
    refreshButton.setAttribute('aria-disabled', String(value));
    _placesDom.emptyElement(refreshButton);
    setIcon(refreshButton, value ? 'loader' : 'refresh-cw');
  };

  const beginProgress = (): (() => void) => {
    const host = options.progressHost ?? options.buttonContainer.parentElement;

    if (!host) return () => undefined;
    _placesDom.addClass(host, 'places-refresh-progress-host');
    const bar = _placesDom.createDiv(host, 'places-refresh-progress');

    return () => {
      bar.remove();
      _placesDom.removeClass(host, 'places-refresh-progress-host');
    };
  };

  refreshButton.addEventListener('click', () => {
    if (busy) return;

    setBusy(true);
    const endProgress = beginProgress();
    const startedAt = Date.now();

    void (async () => {
      try {
        await nextPaint();

        await options.onRefresh();
      } catch (error) {
        options.onError?.(error);
      } finally {
        const remainingMs = MIN_BUSY_MS - (Date.now() - startedAt);

        if (remainingMs > 0) {
          await sleep(remainingMs);
        }

        endProgress();
        setBusy(false);
      }
    })();
  });

  options.registerActions?.(options.buttonContainer);

  return refreshButton;
}
