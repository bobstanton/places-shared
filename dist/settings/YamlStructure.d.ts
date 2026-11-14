export interface YamlField {
    line: number;
    value: string;
}
export interface YamlScope {
    path: string;
    indent: number;
    parent?: YamlScope;
    fields: Map<string, YamlField>;
    entryLine?: number;
    previousEntry?: YamlScope;
}
interface YamlScalar {
    line: number;
    explicit: boolean;
    parentIndent: number;
    contentIndent: number;
}
export interface YamlLine {
    indent: number;
    keyOffset: number;
    dash: boolean;
    colon: number;
    key?: string;
    value: string;
    scope: YamlScope;
    literal?: YamlScalar;
}
export declare function getYamlColumn(text: string, end?: number): number;
export declare function normalizeYamlIndent(text: string, contentIndent?: number): string;
export declare function isYamlBlockScalarIndicator(value: string): boolean;
export declare function getYamlBlockScalarContentIndent(text: string, parentIndent: number, contentIndent: number): number | null;
export declare function isQueryBlockContentLine(text: string, parentIndent: number): boolean;
export declare function scanYamlStructure(text: readonly string[]): YamlLine[];
export {};
