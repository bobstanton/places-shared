import { setIcon } from 'obsidian';
import { sleep } from '../utils/Utilities';

// Keep the button busy for at least this long, even when the refresh resolves
// instantly (cache hit): rapid double clicks cannot trigger a second refresh.
const MIN_BUSY_MS = 1000;

export interface FloatingRefreshButtonOptions {
  buttonContainer: HTMLElement;
  ariaLabel: string;
  className?: string;
  onRefresh: () => Promise<unknown>;
  onError?: (error: unknown) => void;
  // Element that hosts the indeterminate progress bar while refreshing.
  // Defaults to the button container's parent (normally the code block root).
  progressHost?: HTMLElement;
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => window.requestAnimationFrame(() => window.setTimeout(resolve, 0)));
}

// Styles in places-shared loading-styles.css.
export function createFloatingRefreshButton(options: FloatingRefreshButtonOptions): HTMLElement {
  const refreshButton = options.buttonContainer.createDiv(options.className ?? 'places-floating-button');
  refreshButton.setAttribute('aria-label', options.ariaLabel);
  setIcon(refreshButton, 'refresh-cw');

  let busy = false;

  const setBusy = (value: boolean): void => {
    busy = value;
    options.buttonContainer.toggleClass('places-floating-buttons-active', value);
    refreshButton.toggleClass('is-loading', value);
    refreshButton.setAttribute('aria-disabled', String(value));
    refreshButton.empty();
    setIcon(refreshButton, value ? 'loader' : 'refresh-cw');
  };

  const beginProgress = (): (() => void) => {
    const host = options.progressHost ?? options.buttonContainer.parentElement;
    if (!host) return () => undefined;
    host.addClass('places-refresh-progress-host');
    const bar = host.createDiv('places-refresh-progress');
    return () => {
      bar.remove();
      host.removeClass('places-refresh-progress-host');
    };
  };

  refreshButton.addEventListener('click', () => {
    if (busy) return;

    setBusy(true);
    const endProgress = beginProgress();
    const startedAt = Date.now();

    void (async () => {
      try {
        // Refresh work is often synchronous main-thread heavy (query engines run
        // on the main thread); without an explicit paint the busy spinner and
        // progress bar never become visible before the freeze.
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

  return refreshButton;
}
