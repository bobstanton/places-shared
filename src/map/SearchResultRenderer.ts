import { Place } from '../Place';
import { appendText, createDiv, createSpan } from '../utils/Dom';

export const SearchResultClasses = {
  item: 'places-search-result-item',
  icon: 'places-search-result-icon',
  content: 'places-search-result-content',
  name: 'places-search-result-name',
  address: 'places-search-result-address',
  website: 'places-search-result-website',
  tags: 'places-search-result-tags',
  footer: 'places-search-result-footer',
  actions: 'places-search-result-actions',
} as const;

export interface SearchResultRenderOptions {
  renderIcon?: (iconContainer: HTMLElement, source: string) => void;
  showWebsite?: boolean;
  showTags?: boolean;
  renderCustomDetails?: (contentContainer: HTMLElement, place: Place) => void;
  renderActions?: (actionsContainer: HTMLElement, place: Place) => void;
  compact?: boolean;
}

export function renderSearchResult(container: HTMLElement, place: Place, options: SearchResultRenderOptions = {}): void {
  const { renderIcon, showWebsite = true, showTags = true, renderCustomDetails, renderActions, compact = false } = options;

  if (!compact) {
    container.classList.add(SearchResultClasses.item);
  }

  if (renderIcon && place.source) {
    const iconEl = createSpan(container, { cls: SearchResultClasses.icon });

    renderIcon(iconEl, place.source);
  }

  const contentContainer = createDiv(container, { cls: SearchResultClasses.content });

  const displayName = place.name || place.address || 'Unknown location';
  const nameEl = createDiv(contentContainer, { cls: SearchResultClasses.name });

  appendText(nameEl, displayName);

  if (place.address && place.name && place.address !== place.name) {
    const addressEl = createDiv(contentContainer, { cls: SearchResultClasses.address });

    appendText(addressEl, place.address);
  }

  if (renderCustomDetails) {
    renderCustomDetails(contentContainer, place);
  }

  if (showWebsite && place.website) {
    const websiteEl = createDiv(contentContainer, { cls: SearchResultClasses.website });

    appendText(websiteEl, place.website.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  }

  const wantTags = showTags && place.tags && place.tags.length > 0;

  if (!wantTags && !renderActions) return;

  const footer = renderActions ? createDiv(contentContainer, { cls: SearchResultClasses.footer }) : contentContainer;

  if (wantTags) {
    const tagsContainer = createDiv(footer, { cls: SearchResultClasses.tags });

    place.tags.forEach(tag => {
      const tagEl = createSpan(tagsContainer, { cls: 'tag' });

      appendText(tagEl, tag);
    });
  }

  if (renderActions) {
    renderActions(createDiv(footer, { cls: SearchResultClasses.actions }), place);
  }
}
