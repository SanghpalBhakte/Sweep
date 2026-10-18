// Turns an Excel / ODS statement into CSV text so it goes through the same
// reader as CSV files. Works for real .xls/.xlsx files and for the "fake" .xls
// files some banks (SBI, others) send, which are really tab separated text or
// an HTML table.
import * as XLSX from 'xlsx';

const pad = (n: number) => String(n).padStart(2, '0');

function csvCell(value: unknown): string {
  let s: string;
  if (value instanceof Date) {
    // Real date cells become YYYY-MM-DD. Excel's own display format is usually
    // US month-first (m/d/yy), which would turn 5 Oct into 10 May.
    s = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  } else if (value === null || value === undefined) {
    s = '';
  } else {
    s = String(value);
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Reads the sheet with the most data and returns it as CSV text. */
export function excelBufferToCsv(data: Uint8Array | ArrayBuffer): string {
  const book = XLSX.read(data, { type: 'array', cellDates: true, UTC: true, dense: true });
  let best = '';
  for (const name of book.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    const csv = rows
      .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
      .map((r) => r.map(csvCell).join(','))
      .join('\n');
    if (csv.length > best.length) best = csv;
  }
  return best;
}
