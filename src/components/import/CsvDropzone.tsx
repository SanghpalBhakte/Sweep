'use client';

import React, { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Upload,
  FileText,
  Download,
  ShieldCheck,
  AlertCircle,
  FileType,
  FileSpreadsheet,
} from 'lucide-react';

interface StatementDropzoneProps {
  onCsvLoaded: (csvContent: string, fileName: string) => void;
  onPdfLoaded: (file: File) => void;
  isProcessingPdf?: boolean;
}

// Looks like a real HDFC savings account export: account details on top,
// day-first dates, Withdrawal and Deposit columns, UPI and e-mandate narrations.
const SAMPLE_CSV_CONTENT = `Account Name : SAMPLE STUDENT
Account No : 50100XXXXXX123
Statement From : 01/07/2026 To : 30/09/2026

Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
01/07/26,NEFT CR-SBIN0001234-PARENTS-POCKET MONEY,N123456,01/07/26,,"8,000.00","12,450.00"
03/07/26,UPI-SPOTIFY INDIA-spotify.bdsi@icici-ICIC0DC0099-418412345678-Spotify,418412345678,03/07/26,139.00,,"12,311.00"
05/07/26,UPI-SWIGGY-swiggy.stores@axb-UTIB0000100-418612345111-Order,418612345111,05/07/26,412.00,,"11,899.00"
08/07/26,ME DC SI 4XXXXX1234 NETFLIX,0000418812,08/07/26,199.00,,"11,700.00"
12/07/26,UPI-ZOMATO-zomato-order@ptybl-YESB0PTMUPI-419212345222-Pay,419212345222,12/07/26,286.50,,"11,413.50"
15/07/26,UPI-AIRTEL PREPAID-airtelpredirect@airtel-AIRP0000001-419512345333-Recharge,419512345333,15/07/26,349.00,,"11,064.50"
18/07/26,UPI-GOOGLE PLAY-playstore@axisbank-UTIB0000553-419812345444-YouTube,419812345444,18/07/26,129.00,,"10,935.50"
22/07/26,UPI-RAPIDO-rapido.bike@ybl-YESB0YBLUPI-420212345555-Ride,420212345555,22/07/26,64.00,,"10,871.50"
03/08/26,UPI-SPOTIFY INDIA-spotify.bdsi@icici-ICIC0DC0099-421512345666-Spotify,421512345666,03/08/26,139.00,,"10,732.50"
06/08/26,UPI-SWIGGY-swiggy.stores@axb-UTIB0000100-421812345777-Order,421812345777,06/08/26,689.00,,"10,043.50"
08/08/26,ME DC SI 4XXXXX1234 NETFLIX,0000422012,08/08/26,199.00,,"9,844.50"
14/08/26,UPI-AIRTEL PREPAID-airtelpredirect@airtel-AIRP0000001-422612345888-Recharge,422612345888,14/08/26,349.00,,"9,495.50"
18/08/26,UPI-GOOGLE PLAY-playstore@axisbank-UTIB0000553-423012345999-YouTube,423012345999,18/08/26,129.00,,"9,366.50"
25/08/26,UPI-AMAZON-amazon@apl-UTIB0000100-423712340000-Order,423712340000,25/08/26,"1,249.00",,"8,117.50"
01/09/26,NEFT CR-SBIN0001234-PARENTS-POCKET MONEY,N123457,01/09/26,,"8,000.00","16,117.50"
03/09/26,UPI-SPOTIFY INDIA-spotify.bdsi@icici-ICIC0DC0099-424612341111-Spotify,424612341111,03/09/26,139.00,,"15,978.50"
08/09/26,ME DC SI 4XXXXX1234 NETFLIX,0000425112,08/09/26,199.00,,"15,779.50"
13/09/26,UPI-AIRTEL PREPAID-airtelpredirect@airtel-AIRP0000001-425612342222-Recharge,425612342222,13/09/26,349.00,,"15,430.50"
18/09/26,UPI-GOOGLE PLAY-playstore@axisbank-UTIB0000553-426112343333-YouTube,426112343333,18/09/26,129.00,,"15,301.50"
20/09/26,UPI-SWIGGY-swiggy.stores@axb-UTIB0000100-426312344444-Order,426312344444,20/09/26,355.00,,"14,946.50"`;

const EXCEL_EXTENSIONS = ['.xls', '.xlsx', '.xlsm', '.ods'];

/** Excel files go through the same reader as CSV. Loaded only when needed. */
async function excelToCsv(file: File): Promise<string> {
  const { excelBufferToCsv } = await import('@/lib/utils/excelStatement');
  return excelBufferToCsv(new Uint8Array(await file.arrayBuffer()));
}

export function StatementDropzone({
  onCsvLoaded,
  onPdfLoaded,
  isProcessingPdf = false,
}: StatementDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = (file: File) => {
    setError(null);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.pdf')) {
      onPdfLoaded(file);
      return;
    }

    if (EXCEL_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      excelToCsv(file)
        .then((csv) => {
          if (!csv.trim()) {
            setError('This Excel file has no rows in it.');
            return;
          }
          onCsvLoaded(csv, file.name);
        })
        .catch(() => {
          setError("Couldn't open this Excel file. Try saving it again, or download the CSV version from your bank.");
        });
      return;
    }

    if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          setError('The selected file appears to be empty.');
          return;
        }
        onCsvLoaded(content, file.name);
      };
      reader.onerror = () => {
        setError('Failed to read the file. Please try again.');
      };
      reader.readAsText(file);
      return;
    }

    setError('Upload a CSV, Excel (.xls or .xlsx) or PDF statement.');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-bank-statement.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadSampleDirectly = () => {
    onCsvLoaded(SAMPLE_CSV_CONTENT, 'sample-bank-statement.csv');
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div className="p-3 text-xs bg-[hsl(var(--danger-subtle))] border border-[hsl(var(--danger)/0.3)] text-[hsl(var(--danger))] rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessingPdf && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer group ${
          isDragging
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
            : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--surface)/0.5)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,.pdf,.xls,.xlsx,.xlsm,.ods"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFile(e.target.files[0]);
            }
          }}
        />

        <div className="space-y-4 max-w-sm mx-auto">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[hsl(var(--surface))] flex items-center justify-center text-[hsl(var(--primary))] group-hover:scale-105 transition-transform shadow-xs">
            {isProcessingPdf ? (
              <div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
              {isProcessingPdf ? 'Reading your PDF...' : 'Upload a bank or card statement'}
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
              Download it from net banking and drop it here, or tap to choose the file.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" size="sm" className="gap-1 text-[11px]">
              <FileSpreadsheet className="w-3 h-3 text-[hsl(var(--primary))]" /> CSV
            </Badge>
            <Badge variant="outline" size="sm" className="gap-1 text-[11px]">
              <FileSpreadsheet className="w-3 h-3 text-[hsl(var(--primary))]" /> Excel
            </Badge>
            <Badge variant="outline" size="sm" className="gap-1 text-[11px]">
              <FileType className="w-3 h-3 text-[hsl(var(--primary))]" /> Digital PDF
            </Badge>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={isProcessingPdf}
            className="pointer-events-none text-xs"
          >
            Choose statement file
          </Button>
        </div>
      </div>

      {/* Privacy Guarantee Banner */}
      <div className="p-3.5 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] flex items-start gap-2.5 text-xs text-[hsl(var(--muted-foreground))]">
        <ShieldCheck className="w-4 h-4 text-[hsl(var(--primary))] mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <div className="font-semibold text-[hsl(var(--foreground))] text-xs">
            Your file stays on your device
          </div>
          <p className="text-[11px] leading-relaxed">
            Your statement is read only in this browser. It is never uploaded or saved. Money
            coming in is ignored, and only the subscriptions you pick get added.
          </p>
        </div>
      </div>

      {/* Sample Statement Testing */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span>Want to test without uploading real bank statements?</span>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadSample}
            className="text-xs gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Download sample CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSampleDirectly}
            className="text-xs gap-1 text-[hsl(var(--primary))]"
          >
            <FileText className="w-3.5 h-3.5" /> Try the sample file
          </Button>
        </div>
      </div>
    </div>
  );
}

// Backward compatibility export alias
export const CsvDropzone = StatementDropzone;
