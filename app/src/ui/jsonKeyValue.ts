import 'react-native-get-random-values';

export interface KVRow {
  id: string;
  key: string;
  value: string;
}

function newRowId(): string {
  return (
    'row_' +
    Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function emptyRow(): KVRow {
  return { id: newRowId(), key: '', value: '' };
}

/**
 * First-layer-only JSON <-> key/value conversion, per the product decision: this is a
 * quick-entry builder for flat objects, not a general JSON editor. A nested object or
 * array value round-trips as a single opaque JSON-text value in its row rather than
 * being decomposed — editing it means editing that raw text directly.
 */
export function jsonTextToRows(text: string): KVRow[] | null {
  if (text.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return null;

  return Object.entries(parsed as Record<string, unknown>).map(
    ([key, value]) => ({
      id: newRowId(),
      key,
      // Strings show unquoted so they're editable as plain text; every other type
      // (including nested objects/arrays) shows its literal JSON text.
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }),
  );
}

// A row's value is interpreted as JSON if it parses cleanly (so `21`, `true`, `null`,
// `{"a":1}` become their real types) and falls back to a plain string otherwise — typing
// quotes around a value (`"007"`) is how to force a numeric-looking value to stay a string.
function interpretValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function rowsToJsonText(rows: KVRow[]): string {
  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    obj[key] = interpretValue(row.value);
  }
  return JSON.stringify(obj, null, 2);
}
