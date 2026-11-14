export interface POIFilterFields {
  class?: string;
  subclass?: string;
  name?: string;
  tags?: string[];
}

export function shouldFilterPOI(patterns: string[], fields: POIFilterFields): boolean {
  if (!patterns || patterns.length === 0) return false;

  const valuesToCheck: string[] = [];

  if (fields.class) valuesToCheck.push(fields.class);
  if (fields.subclass) valuesToCheck.push(fields.subclass);
  if (fields.name) valuesToCheck.push(fields.name);

  if (fields.tags) {
    valuesToCheck.push(...fields.tags.filter(t => t && t.trim()));
  }

  if (valuesToCheck.length === 0) return false;

  for (const pattern of patterns) {
    if (!pattern || !pattern.trim()) continue;

    const regex = new RegExp(pattern, 'i');

    for (const value of valuesToCheck) {
      if (regex.test(value)) {
        return true;
      }
    }
  }

  return false;
}
