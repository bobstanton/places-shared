import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from "obsidian";
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

// Drop-in replacement for Obsidian's requestUrl. Requests made through
// requestUrl run in Electron's main process and never appear in the DevTools
// network tab; with developer mode enabled this logs method, URL (credentials
// redacted), status, and duration to the console instead.
export async function loggedRequestUrl(params: RequestUrlParam | string): Promise<RequestUrlResponse> {
  if (!requestLoggingEnabled) {
    return requestUrl(params);
  }

  const url = typeof params === "string" ? params : params.url;
  const method = (typeof params === "string" ? undefined : params.method) ?? "GET";
  const started = performance.now();

  try {
    const response = await requestUrl(params);
    logger.info(`${method} ${redactUrl(url)} -> ${response.status} (${Math.round(performance.now() - started)}ms)`);
    return response;
  } catch (error) {
    logger.warn(`${method} ${redactUrl(url)} -> threw (${Math.round(performance.now() - started)}ms)`, error);
    throw error;
  }
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.includes(param.toLowerCase())) {
        parsed.searchParams.set(param, "REDACTED");
      }
    }
    return parsed.href;
  } catch {
    return url;
  }
}
