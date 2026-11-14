import { logger } from '../../utils/index';
import { App, Component, MarkdownRenderer, TFile } from 'obsidian';
import type { MapPlace } from '../../place/index';
import {
  appendDefaultGeoJsonProperties,
  appendPopupFields,
  buildPopupTemplateContext,
  getPopupMarkdownSourcePath,
  getPopupTargetSourcePath,
  mapsAreDisabledForRender,
  POPUP_DISABLE_MAPS_ATTRIBUTE,
  renderSuppressedMapPlaceholder,
  type PopupRenderer,
  type PopupRendererOutputSection,
  type PopupTarget,
  type RenderedNoteContent,
} from '../../map/index';
import { resolvePopupSections, mergePopupContentConfig, type PopupContentConfig, type PopupRendererSectionConfig } from '../../settings/index';

export { mapsAreDisabledForRender, POPUP_DISABLE_MAPS_ATTRIBUTE, renderSuppressedMapPlaceholder };

interface PopupContentLifetime {
  owned: boolean;
  closed: boolean;
  cleanups: Set<() => void>;
  observers: Set<() => void>;
  controller?: AbortController;
}

export function popupContentSignal(content: Node): AbortSignal {
  const lifetime = lifetimeFor(content);

  if (!lifetime.controller) {
    const controller = lifetime.controller = new AbortController();

    if (lifetime.closed) controller.abort();
    else lifetime.cleanups.add(() => controller.abort());
  }

  return lifetime.controller.signal;
}

const popupLifetimes = new WeakMap<Node, PopupContentLifetime>();

function lifetimeFor(content: Node): PopupContentLifetime {
  let lifetime = popupLifetimes.get(content);

  if (!lifetime) {
    lifetime = { owned: false, closed: false, cleanups: new Set(), observers: new Set() };
    popupLifetimes.set(content, lifetime);
  }

  return lifetime;
}

export function ownPopupContent(content: Node, onClose: (dispose: () => void) => void): void {
  const lifetime = lifetimeFor(content);

  if (lifetime.owned) return;
  lifetime.owned = true;
  for (const stop of lifetime.observers) stop();
  lifetime.observers.clear();
  onClose(() => {
    lifetime.closed = true;
    for (const dispose of lifetime.cleanups) dispose();
    lifetime.cleanups.clear();
  });
}

export interface RenderedPopupContent extends RenderedNoteContent {
  component: Component;
}

export interface AsyncPopupRenderOptions {
  readonly onRendered?: () => void;
  readonly markdownSourcePath?: string;
  readonly popupRenderers?: readonly PopupRenderer[];
}

export async function renderPopupTargetContentCore(
  app: App,
  target: PopupTarget,
  config: PopupContentConfig | undefined,
  containerElement: HTMLElement,
  popupRenderers: readonly PopupRenderer[] = [],
): Promise<RenderedPopupContent | null> {
  return renderPopupTargetContentResolved(app, target, target.kind === 'place' ? mergePopupContentConfig(config, target.place.settings?.popup) : config, containerElement, popupRenderers);
}

async function renderPopupTargetContentResolved(
  app: App,
  target: PopupTarget,
  config: PopupContentConfig | undefined,
  containerElement: HTMLElement,
  popupRenderers: readonly PopupRenderer[],
): Promise<RenderedPopupContent | null> {
  const component = new Component();

  component.load();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    component.unload();
  };
  let bodyElement: HTMLElement | null = null;

  try {
    if (!config) {
      const rendered = await renderDefaultPopupBody(app, target, containerElement, component);

      if (!rendered) {
        dispose();

        return null;
      }

      return { component, dispose };
    }

    const sections = resolvePopupSections(config);

    bodyElement = containerElement.createDiv({ cls: 'places-popup-body' });
    bodyElement.setAttribute(POPUP_DISABLE_MAPS_ATTRIBUTE, 'true');

    for (const section of sections) {
      if (section.type === 'renderer') {
        await renderCustomSection(app, target, section, popupRenderers, bodyElement, component);
      } else {
        await renderResolvedSection(app, target, section, bodyElement, component);
      }
    }

    return { component, dispose };
  } catch (error) {
    bodyElement?.remove();
    dispose();

    if (config) {
      logger.scope('Popups').warn('Popup content failed to resolve; rendering the default content', {
        target: target.kind === 'place' ? target.place.filePath ?? target.place.name : target.sourcePath ?? target.feature.geometry?.type,
        error: error instanceof Error ? error.message : String(error),
      });

      return renderPopupTargetContentResolved(app, target, undefined, containerElement, popupRenderers);
    }

    throw error;
  }
}

export async function renderPopupContentCore(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null> {
  return renderPopupTargetContentCore(app, { kind: 'place', place }, undefined, containerElement);
}

export async function renderPopupContent(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null> {
  try {
    return await renderPopupContentCore(app, place, containerElement);
  } catch (error) {
    logger.error(`Failed to load content for ${place.filePath}:`, error);

    return null;
  }
}

export function renderPopupContentAsync(app: App, place: MapPlace, containerElement: HTMLElement, config?: PopupContentConfig, options?: AsyncPopupRenderOptions): void {
  renderPopupTargetContentAsync(app, { kind: 'place', place, markdownSourcePath: options?.markdownSourcePath }, config, containerElement, options);
}

export function renderFeaturePopupContentAsync(
  app: App,
  target: Extract<PopupTarget, { kind: 'feature' }>,
  config: PopupContentConfig | undefined,
  containerElement: HTMLElement,
  options?: AsyncPopupRenderOptions,
): void {
  renderPopupTargetContentAsync(app, target, config, containerElement, options);
}

function renderPopupTargetContentAsync(app: App, target: PopupTarget, config: PopupContentConfig | undefined, containerElement: HTMLElement, options?: AsyncPopupRenderOptions): void {
  const lifetime = lifetimeFor(containerElement);

  if (lifetime.closed) return;
  const loadingEl = containerElement.createDiv({ text: 'Loading...', cls: 'places-popup-loading' });
  let disposed = false;
  let rendered: RenderedPopupContent | null = null;
  let observer: MutationObserver | undefined;
  const imageCleanups: (() => void)[] = [];
  const stopObserver = () => { observer?.disconnect(); lifetime.observers.delete(stopObserver); };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopObserver();
    lifetime.cleanups.delete(dispose);
    for (const cleanup of imageCleanups) cleanup();
    rendered?.dispose();
  };

  lifetime.cleanups.add(dispose);

  if (!lifetime.owned) {
    let wasConnected = containerElement.isConnected;
    const Observer = containerElement.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;

    observer = new Observer(() => {
      wasConnected ||= containerElement.isConnected;
      if (wasConnected && !containerElement.isConnected) dispose();
    });
    observer.observe(containerElement.ownerDocument.documentElement, { childList: true, subtree: true });
    lifetime.observers.add(stopObserver);
  }

  void (async () => {
    try {
      rendered = await renderPopupTargetContentCore(app, target, config, containerElement, options?.popupRenderers);
      loadingEl.remove();

      if (disposed) { rendered?.dispose();

 return; }

      options?.onRendered?.();

      if (!rendered) { dispose();

 return; }

      for (const image of containerElement.querySelectorAll('img')) {
        const onLoad = () => { if (!disposed) options?.onRendered?.(); };

        image.addEventListener('load', onLoad, { once: true });
        imageCleanups.push(() => image.removeEventListener('load', onLoad));
      }
    } catch (error) {
      if (!disposed) {
        loadingEl.textContent = 'Error loading content';
        logger.scope('Popups').error('Failed to render popup content', error);
      }

      dispose();
    }
  })();
}

async function renderCustomSection(app: App, target: PopupTarget, section: PopupRendererSectionConfig, renderers: readonly PopupRenderer[], container: HTMLElement, component: Component): Promise<void> {
  const { rendererId, options } = section;
  const renderer = renderers.find(candidate => candidate.id === rendererId);

  if (!renderer) throw new Error(`Popup renderer "${rendererId}" is not available.`);

  const request = {
    target,
    context: buildPopupTemplateContext(target),
    markdownSourcePath: getPopupMarkdownSourcePath(target),
    options,
  };

  if (renderer.kind === 'sections') {
    const sections: unknown = await renderer.render(request);

    if (!isPopupRendererOutputSections(sections)) throw new Error(`Popup renderer "${rendererId}" did not return a section list.`);

    for (const section of sections) {
      await renderResolvedSection(app, target, section, container, component);
    }

    return;
  }

  const sectionElement = container.createDiv({ cls: 'places-popup-custom' });

  sectionElement.dataset.popupRenderer = rendererId;
  sectionElement.setAttribute(POPUP_DISABLE_MAPS_ATTRIBUTE, 'true');
  const onDispose = (cleanup: () => void): void => component.register(cleanup);
  const cleanup = await renderer.render({
    ...request,
    container: sectionElement,
    renderMarkdown: async (markdown, markdownContainer = sectionElement) => {
      markdownContainer.setAttribute(POPUP_DISABLE_MAPS_ATTRIBUTE, 'true');

      await MarkdownRenderer.render(app, markdown, markdownContainer, request.markdownSourcePath ?? '', component);
    },
    onDispose,
  });

  if (cleanup) onDispose(cleanup);
}

function isPopupRendererOutputSections(value: unknown): value is readonly PopupRendererOutputSection[] {
  return Array.isArray(value) && value.every(section => {
    if (!section || typeof section !== 'object') return false;
    const candidate = section as Record<string, unknown>;

    if (candidate.type === 'note') return true;
    if (candidate.type === 'markdown') return typeof candidate.markdown === 'string';

    return candidate.type === 'fields' && Array.isArray(candidate.fields);
  });
}

async function renderResolvedSection(app: App, target: PopupTarget, section: PopupRendererOutputSection, container: HTMLElement, component: Component): Promise<void> {
  if (section.type === 'fields') {
    appendPopupFields(container, section.fields);

    return;
  }

  if (section.type === 'markdown') {
    await renderMarkdownSection(app, section.markdown, getPopupMarkdownSourcePath(target) ?? '', container, component);

    return;
  }

  if (section.type === 'note') {
    await renderNoteSection(app, getPopupTargetSourcePath(target), container, component);

    return;
  }

  throw new Error('Popup renderer returned an unknown section type.');
}

async function renderDefaultPopupBody(app: App, target: PopupTarget, container: HTMLElement, component: Component): Promise<boolean> {
  if (target.kind === 'feature') {
    appendDefaultGeoJsonProperties(
      container,
      target.feature.properties,
      target.presentation ?? 'feature',
    );

    return true;
  }

  return renderNoteSection(app, target.place.filePath, container, component);
}

async function renderNoteSection(app: App, filePath: string | undefined, container: HTMLElement, component: Component): Promise<boolean> {
  if (!filePath) return false;
  const directFile = app.vault.getAbstractFileByPath(filePath);
  const file = directFile instanceof TFile
    ? directFile
    : app.metadataCache.getFirstLinkpathDest(filePath.replace(/\.md$/i, ''), '');

  if (!(file instanceof TFile) || !/\.md$/i.test(file.path)) return false;
  const content = await app.vault.cachedRead(file);
  const noteElement = container.createDiv({ cls: 'places-popup-note' });

  noteElement.setAttribute(POPUP_DISABLE_MAPS_ATTRIBUTE, 'true');
  await MarkdownRenderer.render(app, content, noteElement, file.path, component);

  return true;
}

async function renderMarkdownSection(app: App, markdown: string, sourcePath: string, container: HTMLElement, component: Component): Promise<void> {
  const markdownElement = container.createDiv({ cls: 'places-popup-markdown' });

  markdownElement.setAttribute(POPUP_DISABLE_MAPS_ATTRIBUTE, 'true');

  await MarkdownRenderer.render(app, markdown, markdownElement, sourcePath, component);
}
