export interface GeocodingSearchResult {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  website?: string;
  tags: string[];
  source: string;
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

export const nonBlankText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
