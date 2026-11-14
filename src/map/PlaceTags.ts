export function normalizeFrontmatterTags(raw: unknown): string[] {
  const parts: unknown[] = Array.isArray(raw) ? raw : [raw];

  return [...new Set(parts.flatMap(part => typeof part === 'string' ? part.split(/[,;\s]+/) : [])
    .map(tag => tag.replace(/^#/, '').trim()).filter(Boolean))];
}

export function tagMatchNames(raw: unknown): string[] {
  return [...new Set(normalizeFrontmatterTags(raw).flatMap(tag => {
    const full = tag.toLowerCase();
    const leaf = full.slice(full.lastIndexOf('/') + 1);

    return full === leaf ? [full] : [full, leaf];
  }))];
}
