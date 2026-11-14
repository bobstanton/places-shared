import { type RequestUrlResponse } from '../utils/HttpLogging';
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type RequestUrlFetchWrapper = (url: string, send: () => Promise<RequestUrlResponse>) => Promise<RequestUrlResponse>;
export declare function createRequestUrlFetch(wrap?: RequestUrlFetchWrapper): FetchLike;
