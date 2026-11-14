import { BlockSyntaxError } from './CodeBlockYaml';

export type PlaceSource = string | Record<string, unknown>;

export function parsePlaceSources(value: unknown): readonly PlaceSource[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BlockSyntaxError('The "places" setting must be a list.', undefined, 'places');

  return value.map((entry: unknown, index) => {
    if (typeof entry === 'string') {
      const path = entry.trim().replace(/^\[\[([\s\S]*)\]\]$/, '$1').split('|')[0].split('#')[0].trim();

      if (path) return path;
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return entry as Record<string, unknown>;
    }

    throw new BlockSyntaxError(`Item ${index + 1} in "places" must be a file reference or a mapping of place properties.`, undefined, 'places');
  });
}

export function placeSourcePaths(sources: readonly PlaceSource[] | undefined): string[] {
  return sources?.filter((entry): entry is string => typeof entry === 'string') ?? [];
}
