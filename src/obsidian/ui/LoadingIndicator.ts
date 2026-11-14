export interface LoadingIndicatorOptions {
  className?: string;
}

export function createLoadingIndicator(container: HTMLElement, initialText: string = "Loading...", options?: LoadingIndicatorOptions): { setText: (text: string) => void; remove: () => void } {
  const loadingContainer = container.createDiv({ cls: "places-centered-column" });

  if (options?.className) loadingContainer.addClass(options.className);
  const loadingText = loadingContainer.createDiv({
    text: initialText,
    cls: "places-loading-text"
  });

  loadingContainer.createDiv({ cls: "places-loading-spinner" });

  return {
    setText: (text: string) => loadingText.setText(text),
    remove: () => loadingContainer.remove()
  };
}
