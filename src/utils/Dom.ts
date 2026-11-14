export interface CreateElementOptions {
  cls?: string | string[];
  text?: string | DocumentFragment;
  attr?: Record<string, string | number | boolean | null>;
  [property: string]: unknown;
}

function serializeAttributeValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(serializeAttributeValue).join(' ');
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || typeof value === 'symbol') return String(value);

  return JSON.stringify(value) ?? '';
}

function ownerDocument(parent: Node | null): Document {
  const documentRef = parent?.ownerDocument
    ?? (parent?.nodeType === 9 ? parent as Document : globalThis.document);

  if (!documentRef) throw new Error("DOM document is unavailable");

  return documentRef;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(parent: Node | null, tagName: K, options: CreateElementOptions | string = {}): HTMLElementTagNameMap[K] {
  const normalized = typeof options === "string" ? { cls: options } : options;

  const target = normalized.parent instanceof Node ? normalized.parent : parent;
  const element = ownerDocument(target).createElement(tagName);

  if (normalized.cls) {
    const classes = Array.isArray(normalized.cls) ? normalized.cls : normalized.cls.split(/\s+/);

    element.classList.add(...classes.filter(Boolean));
  }

  if (normalized.text !== undefined) setText(element, normalized.text);
  for (const [name, value] of Object.entries(normalized.attr ?? {})) setAttribute(element, name, value);

  for (const [name, value] of Object.entries(normalized)) {
    if (name === "cls" || name === "text" || name === "attr" || name === "parent" || name === "prepend" || value === undefined) continue;

    if (name in element) {
      (element as unknown as Record<string, unknown>)[name] = value;
    } else {
      element.setAttribute(name, serializeAttributeValue(value));
    }
  }

  if (normalized.prepend && target?.firstChild) target.insertBefore(element, target.firstChild);
  else target?.appendChild(element);

  return element;
}

export function createDiv(parent: Node | null, options: CreateElementOptions | string = {}): HTMLDivElement {
  return createElement(parent, "div", options);
}

export function createSpan(parent: Node | null, options: CreateElementOptions | string = {}): HTMLSpanElement {
  return createElement(parent, "span", options);
}

export function appendText(element: Node, text: string): void {
  element.appendChild(ownerDocument(element).createTextNode(text));
}

export function emptyElement(element: Element): void {
  element.replaceChildren();
}

export function setCssProperties(element: HTMLElement | SVGElement, properties: Record<string, string>): void {
  for (const [name, value] of Object.entries(properties)) {
    if (name in element.style) {
      (element.style as unknown as Record<string, string>)[name] = value;
    } else {
      element.style.setProperty(name, value);
    }
  }
}

export function setText(element: Element, text: string | DocumentFragment): void {
  if (typeof text === 'string') element.textContent = text;
  else element.replaceChildren(text);
}

export function addClass(element: Element, ...classes: string[]): void {
  element.classList.add(...classes.flatMap(value => value.split(/\s+/)).filter(Boolean));
}

export function removeClass(element: Element, ...classes: string[]): void {
  element.classList.remove(...classes.flatMap(value => value.split(/\s+/)).filter(Boolean));
}

export function toggleClass(element: Element, classes: string | string[], enabled: boolean): void {
  for (const name of typeof classes === 'string' ? classes.split(/\s+/) : classes) {
    if (name) element.classList.toggle(name, enabled);
  }
}

export function setCssStyles(element: HTMLElement | SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles);
}

export function setAttribute(element: Element, name: string, value: string | number | boolean | null): void {
  if (value === null || value === false) element.removeAttribute(name);
  else element.setAttribute(name, value === true ? 'true' : String(value));
}

export function setAttributes(element: Element, attributes: Record<string, string | number | boolean | null>): void {
  for (const [name, value] of Object.entries(attributes)) setAttribute(element, name, value);
}

export function getAttribute(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

export function createSvg<K extends keyof SVGElementTagNameMap>(parent: Node, tag: K, options: CreateElementOptions | string = {}): SVGElementTagNameMap[K] {
  const element = ownerDocument(parent).createElementNS('http://www.w3.org/2000/svg', tag);
  const normalized = typeof options === 'string' ? { cls: options } : options;

  if (normalized.cls) element.setAttribute('class', Array.isArray(normalized.cls) ? normalized.cls.join(' ') : normalized.cls);
  if (normalized.text !== undefined) setText(element, normalized.text);
  for (const [name, value] of Object.entries(normalized.attr ?? {})) element.setAttribute(name, String(value));
  parent.appendChild(element);

  return element;
}

export function hideElement(element: HTMLElement): void { element.hidden = true; }
export function showElement(element: HTMLElement): void { element.hidden = false; }
export function removeElement(element: Element): void { element.remove(); }
export function findElement<T extends Element = Element>(element: Element, selector: string): T | null { return element.querySelector<T>(selector); }
export function findElements<T extends Element = Element>(element: Element, selector: string): T[] { return Array.from(element.querySelectorAll<T>(selector)); }
