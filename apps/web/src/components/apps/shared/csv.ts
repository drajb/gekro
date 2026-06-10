/**
 * csv.ts — RFC 4180 compliant CSV export utility
 *
 * exportRows() triggers a browser download of the given rows as a .csv file.
 * Handles values containing commas, quotes, and newlines per the spec.
 */

function escapeCell(value: string | number | null | undefined): string {
  let str = value == null ? '' : String(value);
  // Spreadsheet-formula-injection guard: cells starting with = + - @ execute
  // as formulas when the CSV is opened in Excel/Sheets (e.g. =HYPERLINK(...)).
  // Prefix with an apostrophe so they render as literal text. Numbers passed
  // as numbers are unaffected (they stringify without a leading operator
  // unless negative — negative NUMBERS are safe, so only guard strings).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Wrap in quotes if value contains comma, double-quote, or any line break
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportRows(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => headers.map(h => escapeCell(row[h])).join(',')),
  ];

  const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
