import { parse as parseYaml } from 'yaml';
import { normalizePlacesYaml } from './CodeBlockSyntax';
import { getErrorMessage, normalizePropertyName } from '../utils/Utilities';

export type CodeBlockMapping = Record<string, unknown>;

// A user-facing syntax or schema error in a YAML-backed code block.
export class BlockSyntaxError extends Error {
  constructor(message: string, public readonly line?: number, public readonly key?: string) {
    super(message);
    this.name = 'BlockSyntaxError';
  }
}

export interface ParseCodeBlockYamlOptions {
  // Source shown to the user when the parsed text was normalized first.
  originalSource?: string;
  // Text fields whose documented grammar permits unquoted `name: value` fragments.
  colonTextKeys?: readonly string[];
}

export function parseCodeBlockYaml(source: string, options: ParseCodeBlockYamlOptions = {}): CodeBlockMapping {
  if (!source.trim()) return {};

  const yamlSource = normalizePlacesYaml(source, options.colonTextKeys);

  let parsed: unknown;

  try {
    parsed = parseYaml(yamlSource) as unknown;
  } catch (error) {
    throw toBlockSyntaxError(error, options.originalSource ?? source);
  }

  if (parsed === null || parsed === undefined) return {};

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BlockSyntaxError('The block must contain a YAML mapping of setting names to values.');
  }

  return parsed as CodeBlockMapping;
}

// Read a scalar setting as text and reject lists and mappings.
export function codeBlockText(settings: CodeBlockMapping, key: string): string | undefined {
  const value = settings[key];

  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  throw new BlockSyntaxError(`The "${key}" setting must be text.`, undefined, key);
}

export class CodeBlockReader {
  readonly values: CodeBlockMapping;

  constructor(sourceOrValues: string | CodeBlockMapping, options: ParseCodeBlockYamlOptions = {}) {
    this.values = typeof sourceOrValues === 'string' ? parseCodeBlockYaml(sourceOrValues, options) : sourceOrValues;
  }

  raw(key: string): unknown {
    const normalized = normalizePropertyName(key);
    const matches = Object.keys(this.values).filter(candidate =>
      normalizePropertyName(candidate) === normalized && this.values[candidate] != null);

    if (matches.length > 1 && matches.some(candidate => JSON.stringify(this.values[candidate]) !== JSON.stringify(this.values[matches[0]]))) {
      throw new BlockSyntaxError(`Conflicting spellings of "${key}": ${matches.join(', ')}. Keep one value.`, undefined, key);
    }

    return matches.length ? this.values[matches[0]] : undefined;
  }

  text(key: string): string | undefined {
    const value = this.raw(key);

    return codeBlockText({ [key]: value }, key);
  }

  textList(key: string): string[] {
    const value = this.raw(key);

    if (value === undefined || value === null) return [];

    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return String(item);

        throw new BlockSyntaxError(`Item ${index + 1} in "${key}" must be text.`, undefined, key);
      });
    }

    const text = this.text(key);

    return text ? text.split(',').map(item => item.trim()).filter(Boolean) : [];
  }
}

export function normalizeCodeBlockKeys(values: CodeBlockMapping, keys: readonly string[]): CodeBlockMapping {
  const result = { ...values };
  const reader = new CodeBlockReader(values);
  const canonical = new Map(keys.map(key => [normalizePropertyName(key), key]));

  for (const key of Object.keys(values)) {
    const target = canonical.get(normalizePropertyName(key));

    if (target) {
      if (target !== key) delete result[key];
      result[target] = reader.raw(target);
    }
  }

  return result;
}

export { normalizePropertyName } from '../utils/Utilities';

function toBlockSyntaxError(error: unknown, originalSource: string): BlockSyntaxError {
  const rawMessage = getErrorMessage(error);
  const position = rawMessage.match(/at line (\d+), column \d+/) ?? rawMessage.match(/\((\d+):\d+\)/);
  const reportedIndex = position ? Number(position[1]) - 1 : -1;
  const sourceLines = originalSource.replace(/\r\n/g, '\n').split('\n');
  const sourceIndex = reportedIndex;
  const offendingText = sourceLines[sourceIndex]?.trim() ?? '';
  const lineNumber = sourceIndex >= 0 ? sourceIndex + 1 : undefined;
  const where = lineNumber !== undefined ? `Line ${lineNumber}` : 'The block';
  const quoted = offendingText ? ` ("${truncate(offendingText, 60)}")` : '';
  const keyOnLine = offendingText.match(/^([A-Za-z]\w*)\s*:/)?.[1];

  if (/Implicit map keys need to be followed by map values/.test(rawMessage)) {
    const previousKey = findPreviousKey(sourceLines, sourceIndex >= 0 ? sourceIndex : sourceLines.length);
    const continuationOf = previousKey ? ` of "${previousKey}:"` : '';

    return new BlockSyntaxError(`${where}${quoted} is not indented. Continuation lines${continuationOf} must be indented by at least one space.`, lineNumber, previousKey);
  }

  if (/Unexpected scalar at node end/.test(rawMessage)) {
    const key = keyOnLine ?? findPreviousKey(sourceLines, sourceIndex >= 0 ? sourceIndex + 1 : sourceLines.length);

    return new BlockSyntaxError(`${where}${quoted} has content after the first quoted value. A value containing commas must be one quoted string, or a list with one "- item" per line.`, lineNumber, key);
  }

  if (/Nested mappings are not allowed/.test(rawMessage)) {
    return new BlockSyntaxError(`${where}${quoted} contains a second "name:" inside another setting's value. A line break or indentation is missing.`, lineNumber, keyOnLine);
  }

  const summary = rawMessage.split('\n')[0].replace(/ at line \d+, column \d+.*$/, '');

  return new BlockSyntaxError(`${where}${quoted}: ${summary}.`, lineNumber, keyOnLine);
}

function findPreviousKey(sourceLines: string[], beforeIndex: number): string | undefined {
  for (let index = Math.min(beforeIndex, sourceLines.length) - 1; index >= 0; index--) {
    const match = sourceLines[index].match(/^([A-Za-z]\w*)\s*:/);

    if (match) return match[1];
  }

  return undefined;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}\u2026` : value;
}
