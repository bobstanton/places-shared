export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  return (first === '"' && last === '"') || (first === "'" && last === "'")
    ? trimmed.slice(1, -1)
    : trimmed;
}
