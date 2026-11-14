export interface PopupNoteSectionConfig {
  readonly type: 'note';
}

export interface PopupRendererSectionConfig {
  readonly type: 'renderer';
  readonly rendererId: string;
  readonly options?: PopupRendererOptions;
}

export type PopupRendererOptions = Readonly<Record<string, unknown>>;

export type PopupContentSectionConfig =
  | PopupNoteSectionConfig
  | PopupRendererSectionConfig;

export interface PopupContentConfig {
  readonly content?: readonly PopupContentSectionConfig[];
  readonly rendererOptions?: Readonly<Record<number, PopupRendererOptions>>;
}

export function parsePopupContentConfig(value: unknown, path = 'popup'): PopupContentConfig | undefined {
  if (value === undefined) return undefined;
  if (!isMapping(value)) throw new Error(`${path} must be a mapping.`);

  if (!Object.prototype.hasOwnProperty.call(value, 'content')) {
    throw new Error(`${path} requires content.`);
  }

  const rawContent = value.content;

  if (rawContent === 'none' || rawContent === null) return { content: [] };
  const entries = Array.isArray(rawContent) ? rawContent : [rawContent];
  const optionsOnly = (entry: unknown): entry is Record<string, unknown> => isMapping(entry)
    && Object.prototype.hasOwnProperty.call(entry, 'options')
    && !Object.prototype.hasOwnProperty.call(entry, 'renderer');

  if (entries.some(optionsOnly)) {
    if (!entries.every(optionsOnly)) throw new Error(`${path}.content cannot mix option-only overrides with replacement sections.`);
    const rendererOptions: Record<number, PopupRendererOptions> = {};

    for (const [index, entry] of Object.entries(entries)) {
      const options = parsePopupRendererOptions(entry.options, `${path}.content[${index}].options`);

      if (Object.keys(options).length) rendererOptions[Number(index)] = options;
    }

    return Object.keys(rendererOptions).length ? { rendererOptions } : undefined;
  }

  return { content: Object.entries(entries).map(([index, entry]) => parsePopupSection(entry, `${path}.content[${index}]`)) };
}

function parsePopupSection(value: unknown, path: string): PopupContentSectionConfig {
  if (value === 'note') return { type: 'note' };
  if (!isMapping(value)) throw new Error(`${path} must be note or a renderer mapping.`);

  if (typeof value.renderer !== 'string' || !isPopupRendererId(value.renderer)) {
    throw new Error(`${path}.renderer must be a lowercase renderer id using letters, numbers, periods, underscores, or hyphens.`);
  }

  return { type: 'renderer', rendererId: value.renderer,
    ...(value.options == null ? {} : { options: parsePopupRendererOptions(value.options, `${path}.options`) }),
  };
}

export function parsePopupRendererOptions(value: unknown, path = 'popup.content.options'): PopupRendererOptions {
  if (value == null) return {};
  if (!isMapping(value)) throw new Error(`${path} must be a mapping.`);

  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry != null).map(([key, entry]) => [
    key, key === 'fields' ? parseFields(entry, `${path}.fields`)
      : isMapping(entry) ? parsePopupRendererOptions(entry, `${path}.${key}`) : entry,
  ]));
}

function mergeRendererOptions(lower: PopupRendererOptions = {}, higher: PopupRendererOptions = {}): PopupRendererOptions {
  return Object.fromEntries([...new Set([...Object.keys(lower), ...Object.keys(higher)])].map(key => {
    const value = higher[key] ?? lower[key];

    return [key, isMapping(value) ? mergeRendererOptions(isMapping(lower[key]) ? lower[key] : {}, value) : value];
  }));
}

export function mergePopupContentConfig(lower: PopupContentConfig | undefined, higher: PopupContentConfig | undefined): PopupContentConfig | undefined {
  if (!higher) return lower;
  if (higher.content !== undefined) return higher;
  const rendererOptions = { ...lower?.rendererOptions };

  for (const [index, options] of Object.entries(higher.rendererOptions ?? {})) {
    rendererOptions[Number(index)] = mergeRendererOptions(rendererOptions[Number(index)], options);
  }

  return { ...lower, rendererOptions };
}

export function resolvePopupSections(config: PopupContentConfig): readonly PopupContentSectionConfig[] {
  const content = [...(config.content ?? [])];

  for (const [index, options] of Object.entries(config.rendererOptions ?? {})) {
    const section = content[Number(index)];

    if (section?.type !== 'renderer') throw new Error(`popup.content[${index}].options requires an inherited renderer.`);
    content[Number(index)] = { ...section, options: mergeRendererOptions(section.options, options) };
  }

  return content;
}

export function isPopupRendererId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value);
}

function parseFields(value: unknown, path: string): readonly string[] {
  if (typeof value === 'string' && value.trim() === '') return [];
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : null;

  if (!values) throw new Error(`${path} must be a list of field names.`);
  const fields = values.map(field => typeof field === 'string' ? field.trim() : '').filter(Boolean);

  if (fields.length !== values.length) {
    throw new Error(`${path} must contain non-empty field names.`);
  }

  return fields;
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
