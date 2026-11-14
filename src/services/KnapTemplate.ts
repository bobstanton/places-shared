import { createEngine, standardFilters, type FilterRegistry } from 'knap';

export type KnapValueFilters = Record<string, (value: unknown) => unknown>;

const engineOptions = {
  allowRegex: false,
  limits: { maxTemplateLength: 100_000, maxOutputLength: 500_000, maxValueLength: 1_000_000, maxOperations: 50_000, maxDepth: 50 },
};
const defaultEngine = createEngine({ ...engineOptions, filters: standardFilters });

export async function renderKnapTemplate(template: string, variables: Readonly<Record<string, unknown>>, valueFilters?: KnapValueFilters): Promise<string> {
  let engine = defaultEngine;

  if (valueFilters) {
    const filters: FilterRegistry = { ...standardFilters };

    for (const [name, filter] of Object.entries(valueFilters)) {
      filters[name] = (value, _param, context) => filter(context ? context.rawValue : value);
    }

    engine = createEngine({ ...engineOptions, filters });
  }

  const result = await engine.render(template, { variables }, { trimOutput: false });

  if (result.errors.length) {
    throw new Error(result.errors.map(error => `Knap line ${error.line}, column ${error.column}: ${error.message}`).join('\n'));
  }

  return result.output;
}
