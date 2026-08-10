import { Place } from '../Place';

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
    container.addClass(SearchResultClasses.item);
  }

  if (renderIcon && place.source) {
    const iconEl = container.createSpan({ cls: SearchResultClasses.icon });
    renderIcon(iconEl, place.source);
  }

  const contentContainer = container.createDiv({ cls: SearchResultClasses.content });

  const displayName = place.name || place.address || 'Unknown location';
  const nameEl = contentContainer.createDiv({ cls: SearchResultClasses.name });
  nameEl.appendText(displayName);

  if (place.address && place.name && place.address !== place.name) {
    const addressEl = contentContainer.createDiv({ cls: SearchResultClasses.address });
    addressEl.appendText(place.address);
  }

  if (renderCustomDetails) {
    renderCustomDetails(contentContainer, place);
  }

  if (showWebsite && place.website) {
    const websiteEl = contentContainer.createDiv({ cls: SearchResultClasses.website });
    websiteEl.appendText(place.website.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  }

  const wantTags = showTags && place.tags && place.tags.length > 0;
  if (!wantTags && !renderActions) return;

  const footer = renderActions ? contentContainer.createDiv({ cls: SearchResultClasses.footer }) : contentContainer;

  if (wantTags) {
    const tagsContainer = footer.createDiv({ cls: SearchResultClasses.tags });
    place.tags.forEach(tag => {
      const tagEl = tagsContainer.createSpan({ cls: 'tag' });
      tagEl.appendText(tag);
    });
  }

  if (renderActions) {
    renderActions(footer.createDiv({ cls: SearchResultClasses.actions }), place);
  }
}
