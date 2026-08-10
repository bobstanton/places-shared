import { type RequestUrlParam, type RequestUrlResponse } from "obsidian";
export declare function configureRequestLogging(enabled: boolean): void;
export declare function loggedRequestUrl(params: RequestUrlParam | string): Promise<RequestUrlResponse>;
