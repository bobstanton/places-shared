import { MarkdownRenderChild, type MarkdownPostProcessorContext } from 'obsidian';
import { syncCodeBlockLayout } from './CodeBlockLayout';

const registrations = new WeakMap<HTMLElement, CodeBlockActions>();

export function registerCodeBlockActions(container: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  if (registrations.has(container)) return;
  const surroundingWidget = container.closest<HTMLElement>('.cm-preview-code-block');

  if (surroundingWidget?.classList.contains('cm-lang-base')) return;
  const block = container.closest<HTMLElement>('[class*="block-language-"]');

  if (!block) return;
  const widget = block.parentElement === surroundingWidget ? surroundingWidget : null;
  const actions = new CodeBlockActions(container, block, widget);

  registrations.set(container, actions);
  ctx.addChild(actions);
}

class CodeBlockActions extends MarkdownRenderChild {
  private readonly group: HTMLElement;
  private readonly observer: MutationObserver;
  private observedRow: HTMLElement | null = null;
  private row: HTMLElement | null = null;
  private disposed = false;

  constructor(container: HTMLElement, private readonly block: HTMLElement, private readonly widget: HTMLElement | null) {
    super(container);
    const hostWindow = container.ownerDocument.win as typeof window;

    this.group = hostWindow.createDiv();
    this.group.className = 'places-native-embed-actions interactive-child';
    this.observer = new hostWindow.MutationObserver(() => this.sync());
    this.observe();
    this.sync();
  }

  private observe(): void {
    this.observer.disconnect();
    const container = this.containerEl;

    for (let element: HTMLElement | null = container; element; element = element.parentElement) {
      this.observer.observe(element, { childList: true });
      if (element === (this.widget ?? this.block)) break;
    }

    if (this.observedRow) this.observer.observe(this.observedRow, { childList: true });
  }

  private detachGroup(): void {
    this.group.remove();

    if (!this.row?.querySelector(':scope > .places-native-embed-actions')) {
      this.row?.classList.remove('places-embed-actions');
    }

    this.row = null;
  }

  private sync(): void {
    if (this.disposed) return;

    if (!this.block.contains(this.containerEl) || (this.widget && !this.widget.contains(this.block))) {
      this.onunload();

      return;
    }

    const row = this.widget?.querySelector<HTMLElement>(':scope > .embed-actions') ?? null;

    if (this.observedRow !== row) {
      this.observedRow = row;
      this.observe();
    }

    const editButton = row?.querySelector<HTMLElement>(':scope > .edit-block-button');

    if (!row || !editButton) {
      for (const button of Array.from(this.group.children)) {
        button.classList.remove('embed-action');
        this.containerEl.appendChild(button);
      }

      this.containerEl.classList.remove('places-native-actions-anchor');
      this.detachGroup();
      syncCodeBlockLayout(this.block, this.widget);

      return;
    }

    if (this.row !== row) {
      this.detachGroup();
      this.row = row;
      row.classList.add('places-embed-actions');
    }

    if (this.group.parentElement !== row) row.insertBefore(this.group, editButton);

    for (const button of Array.from(this.containerEl.children)) {
      button.classList.add('embed-action');
      this.group.appendChild(button);
    }

    this.containerEl.classList.add('places-native-actions-anchor');
    syncCodeBlockLayout(this.block, this.widget);
  }

  onunload(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.detachGroup();
    this.group.replaceChildren();
    this.containerEl.remove();
    syncCodeBlockLayout(this.block, this.widget);
    registrations.delete(this.containerEl);
  }
}
