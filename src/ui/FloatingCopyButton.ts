import * as _placesDom from '../utils';
import { setIcon } from '../services/index';

export interface FloatingCopyButtonOptions {
  buttonContainer: HTMLElement;
  onCopy: () => Promise<unknown>;
  ariaLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  resetDelayMs?: number;
}

export function createFloatingCopyButton(options: FloatingCopyButtonOptions): HTMLElement {
  const idleLabel = options.ariaLabel ?? 'Copy to Markdown';
  const button = _placesDom.createDiv(options.buttonContainer, 'places-floating-button');

  button.setAttribute('aria-label', idleLabel);
  setIcon(button, 'copy');
  let busy = false;

  button.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    _placesDom.addClass(options.buttonContainer, 'places-floating-buttons-active');
    _placesDom.addClass(button, 'is-loading');
    setIcon(button, 'loader');

    void options.onCopy()
      .then(() => {
        setIcon(button, 'check');
        button.setAttribute('aria-label', options.successLabel ?? 'Copied to clipboard!');
      })
      .catch(() => {
        setIcon(button, 'x');
        button.setAttribute('aria-label', options.errorLabel ?? 'Failed to copy');
      })
      .finally(() => {
        window.setTimeout(() => {
          busy = false;
          setIcon(button, 'copy');
          button.setAttribute('aria-label', idleLabel);
          _placesDom.removeClass(options.buttonContainer, 'places-floating-buttons-active');
          _placesDom.removeClass(button, 'is-loading');
        }, options.resetDelayMs ?? 2000);
      });
  });

  return button;
}
