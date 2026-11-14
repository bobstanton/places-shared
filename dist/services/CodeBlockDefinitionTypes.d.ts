export type ParameterValues = string | ({
    default?: string | readonly string[];
} & ({
    examples: readonly string[];
} | {
    choices: readonly string[];
}));
export interface ParameterDefinition {
    name: string;
    description?: string;
    values: ParameterValues;
    multiValue?: boolean;
}
export declare function parameterValueOptions(values: ParameterValues): readonly string[];
export declare function formatParameterValues(values: ParameterValues): string;
export interface NestedKeyDefinition {
    name: string;
    description?: string;
    apply?: string;
}
