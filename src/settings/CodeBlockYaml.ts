import { parseYaml } from 'obsidian';
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

// Parse a code block as one YAML mapping and translate parser failures.
export function parseCodeBlockYaml(source: string, options: ParseCodeBlockYamlOptions = {}): CodeBlockMapping {
  if (!source.trim()) return {};

  const yamlSource = protectColonTextValues(source, options.colonTextKeys ?? []);
  validateCommonSyntaxMistakes(yamlSource);

  let parsed: unknown;
  try {
    parsed = parseYaml(yamlSource) as unknown;
  } catch (error) {
    throw toBlockSyntaxError(error, yamlSource, options.originalSource ?? source);
  }

  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BlockSyntaxError('The block must contain a YAML mapping of setting names to values.');
  }
  return parsed as CodeBlockMapping;
}

// Diagnostics for common mistakes, independent of the host YAML parser's wording.
function validateCommonSyntaxMistakes(source: string): void {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const lineNumber = index + 1;
    if (!/^\s/.test(line) && !trimmed.startsWith('-') && !line.includes(':')) {
      const previousKey = findPreviousKey(lines, index);
      throw new BlockSyntaxError(`Line ${lineNumber} ("${truncate(trimmed, 60)}") is not indented. Continuation lines${previousKey ? ` of "${previousKey}:"` : ''} must be indented by at least one space.`, lineNumber, previousKey);
    }
    const key = trimmed.match(/^([A-Za-z]\w*)\s*:/)?.[1];
    if (key && /^[A-Za-z]\w*:\s*"[^"]*"\s*,/.test(trimmed)) {
      throw new BlockSyntaxError(`Line ${lineNumber} ("${truncate(trimmed, 60)}") has content after the first quoted value. A value containing commas must be one quoted string, or a list with one "- item" per line.`, lineNumber, key);
    }
  }
}

function protectColonTextValues(source: string, keys: readonly string[]): string {
  if (keys.length === 0) return source;
  const normalizedKeys = new Set(keys.map(normalizePropertyName));
  return source.replace(/^([A-Za-z][\w -]*):\s+(.+)$/gm, (line, rawKey: string, rawValue: string) => {
    const value = rawValue.trim();
    if (!normalizedKeys.has(normalizePropertyName(rawKey)) || !value.includes(': ') || /^["'|>]/.test(value)) return line;
    return `${rawKey}: ${JSON.stringify(value)}`;
  });
}

// Read a scalar setting as text and reject lists and mappings.
export function codeBlockText(settings: CodeBlockMapping, key: string): string | undefined {
  const value = settings[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new BlockSyntaxError(`The "${key}" setting must be text.`, undefined, key);
}

// Typed access to a parsed block without flattening YAML values.
export class CodeBlockReader {
  readonly values: CodeBlockMapping;

  constructor(sourceOrValues: string | CodeBlockMapping, options: ParseCodeBlockYamlOptions = {}) {
    this.values = typeof sourceOrValues === 'string' ? parseCodeBlockYaml(sourceOrValues, options) : sourceOrValues;
  }

  raw(key: string): unknown {
    if (Object.prototype.hasOwnProperty.call(this.values, key)) return this.values[key];
    const normalized = normalizePropertyName(key);
    const match = Object.keys(this.values).find(candidate => normalizePropertyName(candidate) === normalized);
    return match === undefined ? undefined : this.values[match];
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

// Folds case/space/underscore/hyphen variants into one comparison form.
export { normalizePropertyName } from '../utils/Utilities';

function toBlockSyntaxError(error: unknown, normalizedText: string, originalSource: string): BlockSyntaxError {
  const rawMessage = getErrorMessage(error);
  const position = rawMessage.match(/at line (\d+), column \d+/) ?? rawMessage.match(/\((\d+):\d+\)/);
  const normalizedLines = normalizedText.split('\n');
  const reportedIndex = position ? Number(position[1]) - 1 : -1;
  const offendingText = normalizedLines[reportedIndex]?.trim() ?? '';
  const sourceLines = originalSource.replace(/\r\n/g, '\n').split('\n');
  const sourceIndex = offendingText ? sourceLines.findIndex(line => line.trim() === offendingText) : -1;
  const lineNumber = sourceIndex >= 0 ? sourceIndex + 1 : (reportedIndex >= 0 ? reportedIndex + 1 : undefined);
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
