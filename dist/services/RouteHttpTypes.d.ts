export interface RouteHttpRequest {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
}
export interface RouteHttpResponse {
    status: number;
    headers: Record<string, string>;
    text: string;
    json: unknown;
}
export type RouteHttpClient = (request: RouteHttpRequest) => Promise<RouteHttpResponse>;
export type ProviderSettings = Record<string, string | undefined>;
export declare function trimBaseUrl(value: string | undefined, fallback: string, stripEndpoints?: RegExp): string;
