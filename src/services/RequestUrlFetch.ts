import { loggedRequestUrl as requestUrl, type RequestUrlResponse } from '../utils/HttpLogging';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type RequestUrlFetchWrapper = (url: string, send: () => Promise<RequestUrlResponse>) => Promise<RequestUrlResponse>;

function toHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);

  return { ...(headers as Record<string, string>) };
}

export function createRequestUrlFetch(wrap?: RequestUrlFetchWrapper): FetchLike {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body;
    const send = (): Promise<RequestUrlResponse> => requestUrl({
      url,
      method: init?.method ?? 'GET',
      headers: toHeaderRecord(init?.headers),
      ...(typeof body === 'string' ? { body } : {}),
      throw: false,
    });

    const response = await (wrap ? wrap(url, send) : send());

    return new Response(response.arrayBuffer, { status: response.status, headers: response.headers });
  };
}
