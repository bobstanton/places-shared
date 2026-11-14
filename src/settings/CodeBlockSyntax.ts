import { STYLE_RULE_KEYS } from './StyleRuleKeys';
import { normalizePropertyName } from '../utils/Utilities';
import { getYamlColumn, normalizeYamlIndent, scanYamlStructure } from './YamlStructure';

export function normalizePlacesYaml(input: string, colonTextKeys: readonly string[] = []): string {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const structure = scanYamlStructure(lines);
  const colonKeys = new Set(colonTextKeys.map(normalizePropertyName));
  const multiline = new Map<number, string[]>();
  const output = lines.map((line, index) => {
    const context = structure[index];

    if (context.literal) {
      const header = structure[context.literal.line];

      if (!context.literal.explicit && header.key && header.keyOffset === 0 && !/^["'[{]/u.test(header.value)) {
        if (!line.trim() || line.trimStart().startsWith('#')) return line;
        const parts = multiline.get(context.literal.line) ?? [header.value.trimEnd()];

        parts.push(line.trim());
        multiline.set(context.literal.line, parts);

        return '';  
      }

      const scalarIndent = context.literal.contentIndent < 0 ? context.literal.parentIndent + 1 : context.literal.contentIndent;

      return normalizeYamlIndent(line, context.literal.explicit ? scalarIndent : Infinity);
    }

    if (!line.trim() || line.trimStart().startsWith('#')) return normalizeYamlIndent(line);
    const { key, value, keyOffset, dash, scope } = context;

    if (!key && !dash) return normalizeYamlIndent(line);
    const indent = ' '.repeat(context.indent) + (dash ? `-${' '.repeat(getYamlColumn(line, keyOffset) - context.indent - 1)}` : '');

    if (dash && STYLE_RULE_KEYS.has(scope.path.split('.').slice(-1)[0] ?? '') && line.includes('=>')) {
      return indent + protectScalar(line.slice(keyOffset), true);
    }

    const prefix = indent + (key ? `${line.slice(keyOffset, context.colon + 1)} ` : '');
    const colonText = key && keyOffset === 0 && colonKeys.has(normalizePropertyName(key)) && value.includes(': ');

    return prefix + protectScalar(value, Boolean(colonText));
  });

  for (const [line, parts] of multiline) {
    output[line] = `${lines[line].slice(0, structure[line].colon + 1)} ${JSON.stringify(`${parts.join('\n')}\n`)}`;
  }

  return output.join('\n');
}

function protectScalar(raw: string, quoteWhole: boolean): string {
  const value = raw.trim();

  if (!value || /^["'|>]/u.test(value)) return raw;
  if (quoteWhole || value.startsWith('{') || /^#[\da-f]{3,8}\b|,\s*#[\da-f]{3,8}\b/iu.test(value)) return JSON.stringify(value);
  const link = value.match(/^(\[\[[^\]]+\]\])(\s*(?:#.*)?)$/u);

  if (link) return JSON.stringify(link[1]) + link[2];
  const [, scalar, comment] = raw.match(/^(\S.*?)(\s+#.*|\s*)$/u) ?? [];

  if (!scalar) return raw;
  const unquoted = scalar.replace(/"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'/gu, '');

  return /^[!&*@`]/u.test(scalar) || /\[\[[^[\]]+\]\]/u.test(unquoted)
    ? JSON.stringify(scalar) + comment : raw;
}
