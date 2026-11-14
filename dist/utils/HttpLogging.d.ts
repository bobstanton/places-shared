export interface RequestUrlParam {
    url: string;
    method?: string;
    contentType?: string;
    body?: string | ArrayBuffer;
    headers?: Record<string, string>;
    throw?: boolean;
}
export interface RequestUrlResponse {
    status: number;
    headers: Record<string, string>;
    arrayBuffer: ArrayBuffer;
    json: unknown;
    text: string;
}
export declare function configureRequestLogging(enabled: boolean): void;
export type UrlRequester = (params: RequestUrlParam | string) => Promise<RequestUrlResponse>;
export declare function configureUrlRequester(next: UrlRequester): void;
export declare function loggedRequestUrl(params: RequestUrlParam | string): Promise<RequestUrlResponse>;
export declare function redactUrl(url: string): string;
