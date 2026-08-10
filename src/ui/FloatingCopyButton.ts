import { setIcon } from 'obsidian';

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
  const button = options.buttonContainer.createDiv('places-floating-button');
  button.setAttribute('aria-label', idleLabel);
  setIcon(button, 'copy');
  let busy = false;

  button.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    options.buttonContainer.addClass('places-floating-buttons-active');
    button.addClass('is-loading');
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
          options.buttonContainer.removeClass('places-floating-buttons-active');
          button.removeClass('is-loading');
        }, options.resetDelayMs ?? 2000);
      });
  });

  return button;
}
