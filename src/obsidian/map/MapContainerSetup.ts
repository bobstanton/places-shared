export interface ConfigureMapContainerOptions {
  className: string;
  css?: string;
}

export function configureMapContainer(container: HTMLElement, options: ConfigureMapContainerOptions): void {
  container.addClass(options.className);

  if (options.css) {
    const styleEl = createEl('style');

    styleEl.textContent = options.css;
    container.appendChild(styleEl);
  }
}
