import { getErrorMessage } from "../utils/Utilities";

export interface ProviderApiErrorOptions {
  provider: string;
  operation: string;
  status: number;
  json?: unknown;
  text?: string;
  requestSummary?: string;
}

export function formatProviderApiError(options: ProviderApiErrorOptions): string {
  const details = extractApiErrorDetails(options.json, options.text);
  const requestContext = options.requestSummary ? ` (${options.requestSummary})` : "";

  if (details) {
    return `${options.provider} rejected the ${options.operation} request${requestContext}: ${details}`;
  }

  return `${options.provider} rejected the ${options.operation} request${requestContext}. The provider returned HTTP ${options.status} without more details.`;
}

export interface ProviderThrownErrorOptions {
  provider: string;
  operation: string;
  requestSummary?: string;
  error: unknown;
}

export async function describeProviderThrownError(options: ProviderThrownErrorOptions): Promise<string> {
  const response = getErrorResponse(options.error);
  const requestContext = options.requestSummary ? ` (${options.requestSummary})` : "";

  if (!response) {
    return `${options.provider} ${options.operation} failed${requestContext}: ${getErrorMessage(options.error)}`;
  }

  const { json, text } = await readResponseBody(response);

  return formatProviderApiError({
    provider: options.provider,
    operation: options.operation,
    status: response.status,
    json,
    text,
    requestSummary: options.requestSummary,
  });
}

interface ReadableErrorResponse {
  status: number;
  text: () => Promise<string>;
}

function getErrorResponse(error: unknown): ReadableErrorResponse | null {
  if (!error || typeof error !== "object" || !("response" in error)) return null;
  const response = (error as { response?: unknown }).response;

  if (!response || typeof response !== "object") return null;
  const candidate = response as Partial<ReadableErrorResponse>;

  return typeof candidate.status === "number" && typeof candidate.text === "function" ? candidate as ReadableErrorResponse : null;
}

async function readResponseBody(response: ReadableErrorResponse): Promise<{ json?: unknown; text: string }> {
  const text = await response.text().catch(() => "");

  if (!text.trim()) return { text };

  return { json: tryParseProviderErrorJson(text), text };
}

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

// A response that parsed but cannot be used. Reports the provider's own
// explanation when the body carries one (a non-Ok `code`/`message` often
// arrives with HTTP 200), and otherwise describes what actually turned up.
export function formatProviderResponseShapeError(options: ProviderResponseShapeErrorOptions): string {
  const requestContext = options.requestSummary ? ` (${options.requestSummary})` : "";
  const details = extractShapeErrorDetails(options.json);
  const head = `${options.provider} returned an unusable ${options.operation} response${requestContext}`;

  if (details) return `${head}: ${details}`;

  const counts = options.expectedCount !== undefined
    ? `expected ${options.expected} for ${options.expectedCount} points, received ${options.receivedCount ?? 0}`
    : `no ${options.expected} in the response`;
  const fields = describeResponseFields(options.json);

  return `${head}: ${counts}.${fields}`;
}

// `code` is a status marker, not a message: a body can say `code: "Ok"` and
// still be unusable. Only a non-Ok code counts, and it prefixes the message rather than
// replacing it. The raw text is deliberately not a fallback here - the body
// parsed as JSON, and dumping it whole would bury the counts below.
function extractShapeErrorDetails(json: unknown): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "";
  const { code, ...rest } = json as Record<string, unknown>;
  const codeText = typeof code === "string" && code.toLowerCase() !== "ok" ? code : "";
  const message = extractApiErrorDetails(rest);

  if (codeText && message) return `${codeText}: ${message}`;

  return codeText || message;
}

function describeResponseFields(json: unknown): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "";
  const keys = Object.keys(json);

  return keys.length > 0 ? ` Response fields: ${keys.join(", ")}.` : "";
}

export function extractApiErrorDetails(json: unknown, text?: string): string {
  if (json && typeof json === "object") {
    const body = json as Record<string, unknown>;
    const message = body.message ?? body.error ?? body.errorMessage ?? body.details ?? body.detail ?? body.code;

    if (message !== undefined) return stringifyApiError(message);
  }

  return text?.trim() ?? "";
}

export function tryParseProviderErrorJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stringifyApiError(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}
