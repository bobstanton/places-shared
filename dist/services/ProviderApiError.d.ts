export interface ProviderApiErrorOptions {
    provider: string;
    operation: string;
    status: number;
    json?: unknown;
    text?: string;
    requestSummary?: string;
}
export declare function formatProviderApiError(options: ProviderApiErrorOptions): string;
export interface ProviderThrownErrorOptions {
    provider: string;
    operation: string;
    requestSummary?: string;
    error: unknown;
}
export declare function describeProviderThrownError(options: ProviderThrownErrorOptions): Promise<string>;
export interface ProviderResponseShapeErrorOptions {
    provider: string;
    operation: string;
    expected: string;
    expectedCount?: number;
    receivedCount?: number;
    json?: unknown;
    text?: string;
    requestSummary?: string;
}
export declare function formatProviderResponseShapeError(options: ProviderResponseShapeErrorOptions): string;
export declare function extractApiErrorDetails(json: unknown, text?: string): string;
export declare function tryParseProviderErrorJson(text: string): unknown;
