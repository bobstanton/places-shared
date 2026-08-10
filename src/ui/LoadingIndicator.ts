// Markup pairs with places-shared/loading-styles.css, which each plugin bundle imports from its main.ts.
export function createLoadingIndicator(container: HTMLElement, initialText: string = "Loading..."): { setText: (text: string) => void; remove: () => void } {
  const loadingContainer = container.createDiv({ cls: "places-centered-column" });
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
