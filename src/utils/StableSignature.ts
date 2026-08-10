import { hashString36 } from './Utilities';

export function normalizeStableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeStableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map(key => [key, normalizeStableValue((value as Record<string, unknown>)[key])])
    );
  }
  return value;
}

export function stableSignature(value: unknown): string {
  return hashString36(JSON.stringify(normalizeStableValue(value)));
}

const signatureByReference = new WeakMap<object, string>();

// Only safe for values treated as immutable after construction.
export function stableSignatureCached(value: object): string {
  let signature = signatureByReference.get(value);
  if (signature === undefined) {
    signature = stableSignature(value);
    signatureByReference.set(value, signature);
  }
  return signature;
}
