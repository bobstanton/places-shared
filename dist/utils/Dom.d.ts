export interface CreateElementOptions {
    cls?: string | string[];
    text?: string | DocumentFragment;
    attr?: Record<string, string | number | boolean | null>;
    [property: string]: unknown;
}
export declare function createElement<K extends keyof HTMLElementTagNameMap>(parent: Node | null, tagName: K, options?: CreateElementOptions | string): HTMLElementTagNameMap[K];
export declare function createDiv(parent: Node | null, options?: CreateElementOptions | string): HTMLDivElement;
export declare function createSpan(parent: Node | null, options?: CreateElementOptions | string): HTMLSpanElement;
export declare function appendText(element: Node, text: string): void;
export declare function emptyElement(element: Element): void;
export declare function setCssProperties(element: HTMLElement | SVGElement, properties: Record<string, string>): void;
export declare function setText(element: Element, text: string | DocumentFragment): void;
export declare function addClass(element: Element, ...classes: string[]): void;
export declare function removeClass(element: Element, ...classes: string[]): void;
export declare function toggleClass(element: Element, classes: string | string[], enabled: boolean): void;
export declare function setCssStyles(element: HTMLElement | SVGElement, styles: Partial<CSSStyleDeclaration>): void;
export declare function setAttribute(element: Element, name: string, value: string | number | boolean | null): void;
export declare function setAttributes(element: Element, attributes: Record<string, string | number | boolean | null>): void;
export declare function getAttribute(element: Element, name: string): string | null;
export declare function createSvg<K extends keyof SVGElementTagNameMap>(parent: Node, tag: K, options?: CreateElementOptions | string): SVGElementTagNameMap[K];
export declare function hideElement(element: HTMLElement): void;
export declare function showElement(element: HTMLElement): void;
export declare function removeElement(element: Element): void;
export declare function findElement<T extends Element = Element>(element: Element, selector: string): T | null;
export declare function findElements<T extends Element = Element>(element: Element, selector: string): T[];
