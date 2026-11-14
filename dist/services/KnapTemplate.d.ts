export type KnapValueFilters = Record<string, (value: unknown) => unknown>;
export declare function renderKnapTemplate(template: string, variables: Readonly<Record<string, unknown>>, valueFilters?: KnapValueFilters): Promise<string>;
