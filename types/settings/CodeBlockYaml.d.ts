export type CodeBlockMapping = Record<string, unknown>;
export declare class BlockSyntaxError extends Error {
    readonly line?: number | undefined;
    readonly key?: string | undefined;
    constructor(message: string, line?: number | undefined, key?: string | undefined);
}
export interface ParseCodeBlockYamlOptions {
    originalSource?: string;
    colonTextKeys?: readonly string[];
}
export declare function parseCodeBlockYaml(source: string, options?: ParseCodeBlockYamlOptions): CodeBlockMapping;
export declare function codeBlockText(settings: CodeBlockMapping, key: string): string | undefined;
export declare class CodeBlockReader {
    readonly values: CodeBlockMapping;
    constructor(sourceOrValues: string | CodeBlockMapping, options?: ParseCodeBlockYamlOptions);
    raw(key: string): unknown;
    text(key: string): string | undefined;
    textList(key: string): string[];
}
export { normalizePropertyName } from '../utils/Utilities';
