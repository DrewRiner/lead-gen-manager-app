/** Escape a single CSV field (RFC 4180). */
function csvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from headers and row objects (keys align to headers). */
export function toCsv(
  headers: { key: string; label: string }[],
  rows: Record<string, unknown>[],
): string {
  const head = headers.map((h) => csvField(h.label)).join(",");
  const body = rows
    .map((row) => headers.map((h) => csvField(row[h.key])).join(","))
    .join("\r\n");
  return body ? `${head}\r\n${body}` : head;
}
