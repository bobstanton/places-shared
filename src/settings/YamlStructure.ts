export interface YamlField {
  line: number;
  value: string;
}

export interface YamlScope {
  path: string;
  indent: number;
  parent?: YamlScope;
  fields: Map<string, YamlField>;
  entryLine?: number;
  previousEntry?: YamlScope;
}

interface YamlScalar {
  line: number;
  explicit: boolean;
  parentIndent: number;
  contentIndent: number;
}

export interface YamlLine {
  indent: number;
  keyOffset: number;
  dash: boolean;
  colon: number;
  key?: string;
  value: string;
  scope: YamlScope;
  literal?: YamlScalar;
}

export function getYamlColumn(text: string, end = text.match(/^[ \t]*/u)![0].length): number {
  let column = 0;

  for (let index = 0; index < end; index++) column += text[index] === '\t' ? 2 - column % 2 : 1;

  return column;
}

export function normalizeYamlIndent(text: string, contentIndent = Infinity): string {
  if (!/^[ \t]*\t/u.test(text)) return text;
  let end = 0;
  let column = 0;

  while (end < text.length && column < contentIndent && /[ \t]/u.test(text[end])) {
    column += text[end++] === '\t' ? 2 - column % 2 : 1;
  }

  return ' '.repeat(column) + text.slice(end);
}

export function isYamlBlockScalarIndicator(value: string): boolean {
  return /^[|>](?:[1-9][+-]?|[+-][1-9]?)?(?:\s+#.*)?\s*$/u.test(value.trim());
}

export function getYamlBlockScalarContentIndent(text: string, parentIndent: number, contentIndent: number): number | null {
  if (!text.trim()) return contentIndent;
  const indent = normalizeYamlIndent(text, contentIndent < 0 ? parentIndent + 1 : contentIndent).match(/^ */u)![0].length;

  return contentIndent < 0 ? (indent > parentIndent ? indent : null) : (indent >= contentIndent ? contentIndent : null);
}

export function isQueryBlockContentLine(text: string, parentIndent: number): boolean {
  return !text.trim() || getYamlColumn(text) > parentIndent;
}

export function scanYamlStructure(text: readonly string[]): YamlLine[] {
  const root: YamlScope = { path: '', indent: -1, fields: new Map() };
  const stack: { indent: number; scope: YamlScope; scalar?: YamlScalar }[] = [{ indent: -1, scope: root }];
  const lastEntries = new Map<YamlScope, YamlScope>();

  return text.map((line, index) => {
    const offset = line.match(/^[ \t]*/u)![0].length;
    const indent = getYamlColumn(line, offset);
    const trimmed = line.trim();
    const top = stack[stack.length - 1];
    const scalar = top.scalar;

    if (scalar && (trimmed || indent > scalar.parentIndent)) {
      const contentIndent = scalar.explicit
        ? getYamlBlockScalarContentIndent(line, scalar.parentIndent, scalar.contentIndent)
        : isQueryBlockContentLine(line, scalar.parentIndent) ? indent : null;

      if (contentIndent !== null) {
        scalar.contentIndent = contentIndent;

        return { indent, keyOffset: offset, dash: false, colon: -1, value: line, scope: top.scope, literal: scalar };
      }
    }

    if (!trimmed || trimmed.startsWith('#')) {
      let ancestor = stack.length - 1;

      while (ancestor > 0 && stack[ancestor].indent >= indent) ancestor--;

      return { indent, keyOffset: offset, dash: false, colon: -1, value: '', scope: stack[ancestor].scope };
    }

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    let scope = stack[stack.length - 1].scope;
    const dash = line.slice(offset).match(/^-(?:\s+|$)/u);
    const keyOffset = offset + (dash?.[0].length ?? 0);
    const keyColumn = getYamlColumn(line, keyOffset);

    if (dash) {
      const parent = scope;

      scope = { path: parent.path, indent, parent, fields: new Map(), entryLine: index, previousEntry: lastEntries.get(parent) };
      lastEntries.set(parent, scope);
      stack.push({ indent, scope });
    }

    const content = line.slice(keyOffset);
    const pair = content.match(/^((?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[A-Za-z][\w. -]*?)[ \t]*):[ \t]*(.*)$/u);
    const key = pair?.[1].trim().replace(/^['"]|['"]$/gu, '');
    const value = pair ? pair[2] : content;
    const result = { indent, keyOffset, dash: Boolean(dash), colon: pair ? keyOffset + pair[1].length : -1, key, value, scope };

    if (key) scope.fields.set(key, { line: index, value });

    if (key || dash) {
      const child: YamlScope = key ? { path: scope.path ? `${scope.path}.${key}` : key, indent: keyColumn, parent: scope, fields: new Map() } : scope;
      const hasValue = value.trim() && (!value.startsWith('#') || /^#[\da-f]{3,8}\b/iu.test(value));
      const explicit = isYamlBlockScalarIndicator(value);
      const indicator = explicit ? value.split(/\s/u)[0].match(/[1-9]/u)?.[0] : undefined;
      const parentIndent = key ? keyColumn : indent;

      stack.push({ indent: keyColumn, scope: child, scalar: hasValue ? {
        line: index, explicit, parentIndent, contentIndent: indicator ? parentIndent + Number(indicator) : -1,
      } : undefined });
    }

    return result;
  });
}
