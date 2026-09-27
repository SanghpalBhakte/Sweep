import { NormalizedTransaction } from '../types';
import { cleanMerchantDescription } from './csvParser';

export interface PdfParseResult {
  success: boolean;
  transactions: NormalizedTransaction[];
  pageCount: number;
  totalTextLines: number;
  error?: string;
  isScannedOrImageOnly?: boolean;
}

interface TextToken {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Client-side PDF Statement text extractor and transaction parser using pdf.js
 */
export async function parsePdfStatement(file: File): Promise<PdfParseResult> {
  try {
    // Dynamic import to prevent SSR build issues
    const pdfjsLib = await import('pdfjs-dist');

    // Configure client-side worker. Served from our own origin (public/pdf.worker.min.mjs,
    // copied from node_modules by scripts/copy-pdf-worker.mjs) instead of a third-party CDN,
    // so it isn't blocked by the site's Content-Security-Policy, an ad blocker, or a flaky
    // network, and doesn't depend on that CDN being reachable at all.
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: true,
      isEvalSupported: false,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    if (numPages === 0) {
      return {
        success: false,
        transactions: [],
        pageCount: 0,
        totalTextLines: 0,
        error: 'The PDF document is empty.',
      };
    }

    let allLines: string[][] = [];
    let totalCharCount = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageTokens: TextToken[] = [];

      for (const item of textContent.items) {
        if ('str' in item && item.str) {
          const str = item.str;
          totalCharCount += str.length;
          // item.transform gives [scaleX, skewY, skewX, scaleY, transX, transY]
          const x = item.transform[4];
          const y = item.transform[5];
          const width = item.width || 0;
          const height = item.height || 0;

          if (str.trim().length > 0) {
            pageTokens.push({ str, x, y, width, height });
          }
        }
      }

      // Group tokens on the same horizontal line (similar Y coordinate)
      const pageLines = groupTokensIntoLines(pageTokens);
      allLines = allLines.concat(pageLines);
    }

    // Check if the PDF has virtually no selectable text (scanned / image-only)
    if (totalCharCount < 60 || allLines.length < 3) {
      return {
        success: false,
        transactions: [],
        pageCount: numPages,
        totalTextLines: allLines.length,
        isScannedOrImageOnly: true,
        error:
          'This PDF appears to be a scanned image or photo without selectable digital text. Sweep parses text-based digital statement PDFs locally. Please export a CSV from your bank or use a digital PDF statement.',
      };
    }

    // Extract transaction rows
    const normalizedTransactions = extractTransactionsFromLines(allLines);

    if (normalizedTransactions.length === 0) {
      return {
        success: false,
        transactions: [],
        pageCount: numPages,
        totalTextLines: allLines.length,
        error:
          'Could not find clear statement transaction rows in this PDF. Bank PDF layouts vary widely. You can export a standard CSV from your bank for 100% reliable detection.',
      };
    }

    return {
      success: true,
      transactions: normalizedTransactions,
      pageCount: numPages,
      totalTextLines: allLines.length,
    };
  } catch (err: any) {
    console.error('PDF parsing error:', err);
    return {
      success: false,
      transactions: [],
      pageCount: 0,
      totalTextLines: 0,
      error: `PDF extraction error: ${err.message || 'Failed to read PDF document.'}`,
    };
  }
}

/**
 * Groups text tokens that share approximately the same Y-axis position into lines
 */
function groupTokensIntoLines(tokens: TextToken[]): string[][] {
  if (tokens.length === 0) return [];

  // Sort tokens from top to bottom (Y descending in PDF space), then left to right (X ascending)
  const sorted = [...tokens].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.5) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lines: string[][] = [];
  let currentLine: TextToken[] = [];
  let currentY = sorted[0].y;

  for (const token of sorted) {
    if (Math.abs(token.y - currentY) <= 3.5) {
      currentLine.push(token);
    } else {
      if (currentLine.length > 0) {
        // Sort tokens left to right
        currentLine.sort((a, b) => a.x - b.x);
        lines.push(currentLine.map((t) => t.str.trim()).filter(Boolean));
      }
      currentLine = [token];
      currentY = token.y;
    }
  }

  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine.map((t) => t.str.trim()).filter(Boolean));
  }

  return lines;
}

/**
 * Scans extracted lines for tabular transaction patterns: [Date, Description..., Amount]
 */
function extractTransactionsFromLines(lines: string[][]): NormalizedTransaction[] {
  const transactions: NormalizedTransaction[] = [];

  const ignoreKeywords = [
    'beginning balance',
    'starting balance',
    'ending balance',
    'total deposits',
    'total withdrawals',
    'total debits',
    'total credits',
    'interest paid',
    'fees charged',
    'page',
    'account number',
    'statement period',
    'subtotal',
    'annual percentage',
    'overdraft',
  ];

  for (let i = 0; i < lines.length; i++) {
    const lineTokens = lines[i];
    const fullLineStr = lineTokens.join(' ').toLowerCase();

    // Skip summary / boilerplate lines
    if (ignoreKeywords.some((kw) => fullLineStr.includes(kw))) {
      continue;
    }

    // Try finding date token
    let dateStr: string | null = null;
    let dateTokenIndex = -1;

    for (let t = 0; t < Math.min(lineTokens.length, 3); t++) {
      const parsedDate = parseTokenDate(lineTokens[t]);
      if (parsedDate) {
        dateStr = parsedDate;
        dateTokenIndex = t;
        break;
      }
    }

    if (!dateStr || dateTokenIndex === -1) {
      continue;
    }

    // Try finding amount token (usually near the end of the line)
    let amount: number | null = null;
    let amountTokenIndex = -1;

    for (let t = lineTokens.length - 1; t > dateTokenIndex; t--) {
      const parsedAmt = parseTokenAmount(lineTokens[t]);
      if (parsedAmt !== null && parsedAmt > 0) {
        amount = parsedAmt;
        amountTokenIndex = t;
        break;
      }
    }

    if (amount === null || amountTokenIndex === -1) {
      continue;
    }

    // Extract Description between Date and Amount
    const descTokens = lineTokens.slice(dateTokenIndex + 1, amountTokenIndex);
    const rawDescription = descTokens.join(' ').trim();

    if (!rawDescription || rawDescription.length < 2) {
      continue;
    }

    const cleanMerchant = cleanMerchantDescription(rawDescription);
    if (!cleanMerchant) {
      continue;
    }

    transactions.push({
      id: `pdf-tx-${i}-${Date.now()}`,
      date: dateStr,
      rawDescription,
      cleanMerchant,
      amount: Math.round(amount * 100) / 100,
    });
  }

  return transactions;
}

/**
 * Checks if a string token is a valid transaction date
 */
function parseTokenDate(token: string): string | null {
  if (!token) return null;
  const clean = token.replace(/[,;]/g, '').trim();

  // Pattern: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Pattern: MM/DD/YYYY or MM/DD/YY or DD/MM/YYYY
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    let [p1, p2, p3] = parts;
    if (p3.length === 2) p3 = `20${p3}`;

    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    const n3 = parseInt(p3, 10);

    if (n3 > 1900 && n1 <= 12 && n2 <= 31) {
      // MM/DD/YYYY
      const m = String(n1).padStart(2, '0');
      const d = String(n2).padStart(2, '0');
      return `${n3}-${m}-${d}`;
    } else if (n3 > 1900 && n1 <= 31 && n2 <= 12) {
      // DD/MM/YYYY
      const d = String(n1).padStart(2, '0');
      const m = String(n2).padStart(2, '0');
      return `${n3}-${m}-${d}`;
    }
  }

  // Pattern: "Jan 15" or "15 Jan" or "Jan 15, 2026"
  const monthMap: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };

  const monthMatch = clean.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (monthMatch) {
    const monthNum = monthMap[monthMatch[1]];
    const dayMatch = clean.match(/\b\d{1,2}\b/);
    const yearMatch = clean.match(/\b20\d{2}\b/);
    const currentYear = new Date().getFullYear();

    if (dayMatch) {
      const dayNum = String(parseInt(dayMatch[0], 10)).padStart(2, '0');
      const yearNum = yearMatch ? yearMatch[0] : String(currentYear);
      return `${yearNum}-${monthNum}-${dayNum}`;
    }
  }

  return null;
}

/**
 * Checks if a string token is a valid monetary amount
 */
function parseTokenAmount(token: string): number | null {
  if (!token) return null;
  const clean = token.replace(/[$€£₹,\s]/g, '').trim();

  // Handle parenthesized negatives (14.99)
  const isParen = clean.startsWith('(') && clean.endsWith(')');
  const numStr = clean.replace(/[()]/g, '');

  if (/^-?\d+(\.\d{2})?$/.test(numStr)) {
    const val = parseFloat(numStr);
    if (!isNaN(val)) {
      return Math.abs(val);
    }
  }

  return null;
}
