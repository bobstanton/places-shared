export function renderHoverPlaceholder(el: HTMLElement, text: string): boolean {
  if (!el.closest('.popover.hover-popover')) return false;
  el.createDiv({ cls: 'places-popover-placeholder', text });

  return true;
}
