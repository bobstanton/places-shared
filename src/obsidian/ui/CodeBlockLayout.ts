export function syncCodeBlockLayout(block: HTMLElement, widget?: HTMLElement | null, excludedStrip?: HTMLElement): void {
  const children = Array.from(block.children);
  const above = children.some(child => child !== excludedStrip && child.classList.contains('places-query-params-above'));
  const floating = children.some(child => child !== excludedStrip && child.classList.contains('places-query-params-floating'));

  block.classList.toggle('places-params-above-host', above);
  block.classList.toggle('places-params-floating-host', floating);

  for (const host of [block, ...children]) {
    const fallback = Array.from(host.children).some(child => child.classList.contains('places-floating-buttons') && !child.classList.contains('places-native-actions-anchor'));

    host.classList.toggle('places-fallback-actions', fallback);
  }

  const parent = widget ?? block.parentElement;

  if (!parent?.matches('.cm-preview-code-block')) return;
  const currentBlock = Array.from(parent.children).find(child => Array.from(child.classList).some(name => name.startsWith('block-language-')));
  const nativeActions = Array.from(parent.children).some(child => child.classList.contains('places-embed-actions'));

  parent.classList.toggle('places-has-native-actions', nativeActions);
  parent.classList.toggle('places-weather-block', currentBlock?.classList.contains('block-language-places-weather') === true);
  parent.classList.toggle('places-params-above-host', currentBlock?.classList.contains('places-params-above-host') === true);
}

export const BLOCK_WIDTH_CLASS = 'places-block-width';

export function applyBlockWidth(block: HTMLElement, width: string | undefined): void {
  const value = width?.trim();

  if (!value || value === '100%') {
    block.removeClass(BLOCK_WIDTH_CLASS);
    block.style.removeProperty('--places-block-width');

    return;
  }

  block.addClass(BLOCK_WIDTH_CLASS);
  block.setCssProps({ '--places-block-width': value });
}
