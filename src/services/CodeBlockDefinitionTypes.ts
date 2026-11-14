export type ParameterValues = string | ({ default?: string | readonly string[] } & (
    { examples: readonly string[] } | { choices: readonly string[] }
));

export interface ParameterDefinition {
    name: string;
    description?: string;
    values: ParameterValues;
    multiValue?: boolean;
}

export function parameterValueOptions(values: ParameterValues): readonly string[] {
    return typeof values === 'string' ? [] : 'choices' in values ? values.choices : values.examples;
}

export function formatParameterValues(values: ParameterValues): string {
    if (typeof values === 'string') return values;
    const options = parameterValueOptions(values);
    const defaults = typeof values.default === 'string' ? [values.default] : values.default ?? [];

    return [...defaults.filter(value => !options.includes(value)), ...options]
        .map(value => defaults.includes(value) ? `**${value}**` : value).join(', ');
}

export interface NestedKeyDefinition {
    name: string;
    description?: string;
    apply?: string;
}
