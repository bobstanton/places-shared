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
import { sharedRegistryValue } from "./CrossBundleRegistry";
import { logger as rootLogger } from "./logger";

const logger = rootLogger.scope("HTTP");

const SENSITIVE_QUERY_PARAMS = ["apikey", "api_key", "key", "access_token", "token"];

let requestLoggingEnabled = false;

// Turn developer-mode request logging on or off for this plugin bundle.
// Each plugin bundles its own copy of places-shared, and every plugin calls
// this from getPlaceExports with the main plugin's developerMode setting.
export function configureRequestLogging(enabled: boolean): void {
  requestLoggingEnabled = enabled;
}

export type UrlRequester = (params: RequestUrlParam | string) => Promise<RequestUrlResponse>;

const REQUESTER_KEY = Symbol.for("places.http.requester");

interface RequesterState {
  requester: UrlRequester | null;
}

const requesterState = sharedRegistryValue<RequesterState>(REQUESTER_KEY, () => ({ requester: null }));

export function configureUrlRequester(next: UrlRequester): void {
  requesterState.requester = next;
}

function requester(params: RequestUrlParam | string): Promise<RequestUrlResponse> {
  if (!requesterState.requester) {
    throw new Error("No HTTP transport registered: call configureUrlRequester at startup");
  }

  return requesterState.requester(params);
}

export async function loggedRequestUrl(params: RequestUrlParam | string): Promise<RequestUrlResponse> {
  if (!requestLoggingEnabled) {
    return requester(params);
  }

  const url = typeof params === "string" ? params : params.url;
  const method = (typeof params === "string" ? undefined : params.method) ?? "GET";
  const started = performance.now();

  try {
    const response = await requester(params);

    logger.info(`${method} ${redactUrl(url)} -> ${response.status} (${Math.round(performance.now() - started)}ms)`);

    return response;
  } catch (error) {
    logger.warn(`${method} ${redactUrl(url)} -> threw (${Math.round(performance.now() - started)}ms)`, error);

    throw error;
  }
}

export function redactUrl(url: string): string {
  return url.replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, separator: string, key: string) =>
    SENSITIVE_QUERY_PARAMS.includes(key.toLowerCase()) ? `${separator}${key}=REDACTED` : match);
}
