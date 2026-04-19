/**
 * csv.ts — RFC 4180 compliant CSV export utility
 *
 * exportRows() triggers a browser download of the given rows as a .csv file.
 * Handles values containing commas, quotes, and newlines per the spec.
 */

function escapeCell(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  // Wrap in quotes if value contains comma, double-quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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
