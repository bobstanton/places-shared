import { Place } from '../Place';
export declare const SearchResultClasses: {
    readonly item: "places-search-result-item";
    readonly icon: "places-search-result-icon";
    readonly content: "places-search-result-content";
    readonly name: "places-search-result-name";
    readonly address: "places-search-result-address";
    readonly website: "places-search-result-website";
    readonly tags: "places-search-result-tags";
    readonly footer: "places-search-result-footer";
    readonly actions: "places-search-result-actions";
};
export interface SearchResultRenderOptions {
    renderIcon?: (iconContainer: HTMLElement, source: string) => void;
    showWebsite?: boolean;
    showTags?: boolean;
    renderCustomDetails?: (contentContainer: HTMLElement, place: Place) => void;
    renderActions?: (actionsContainer: HTMLElement, place: Place) => void;
    compact?: boolean;
}
export declare function renderSearchResult(container: HTMLElement, place: Place, options?: SearchResultRenderOptions): void;
