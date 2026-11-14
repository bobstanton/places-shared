import { loggedRequestUrl } from '../utils/index';
import type { RouteHttpClient } from './index';

export const loggedRouteHttpClient: RouteHttpClient = async (request) => {
  const response = await loggedRequestUrl({
    url: request.url,
    method: request.method ?? 'GET',
    headers: request.headers,
    body: request.body,
    throw: false,
  });

  return {
    status: response.status,
    headers: response.headers ?? {},
    text: response.text ?? '',
    json: safeJson(response.text),
  };
};

function safeJson(text: string | undefined): unknown {
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
