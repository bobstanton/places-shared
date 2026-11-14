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

export function trimBaseUrl(value: string | undefined, fallback: string, stripEndpoints?: RegExp): string {
  const configured = typeof value === 'string' ? value.trim() : '';
  let base = configured || fallback;

  if (stripEndpoints) base = base.replace(stripEndpoints, '');

  return base.replace(/\/$/, '');
}
