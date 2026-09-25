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

const SAMPLE_CSV_CONTENT = `Date,Description,Amount,Type
2026-06-01,SPOTIFY USA 800-555-0199,10.99,Debit
2026-06-05,WHOLE FOODS MARKET,84.20,Debit
2026-06-12,NETFLIX.COM LOS GATOS CA,15.49,Debit
2026-06-15,GITHUB INC SAN FRANCISCO,20.00,Debit
2026-06-20,UBER TRIP HELP.UBER,24.50,Debit
2026-06-28,CHATGPT SUBSCRIPTION OPENAI,20.00,Debit
2026-07-01,SPOTIFY USA 800-555-0199,10.99,Debit
2026-07-08,TRADER JOE'S #142,56.30,Debit
2026-07-12,NETFLIX.COM LOS GATOS CA,15.49,Debit
2026-07-15,GITHUB INC SAN FRANCISCO,20.00,Debit
2026-07-28,CHATGPT SUBSCRIPTION OPENAI,20.00,Debit
2026-08-01,SPOTIFY USA 800-555-0199,10.99,Debit
2026-08-12,NETFLIX.COM LOS GATOS CA,15.49,Debit
2026-08-15,GITHUB INC SAN FRANCISCO,20.00,Debit
2026-08-28,CHATGPT SUBSCRIPTION OPENAI,20.00,Debit`;

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

    setError('Please upload a valid .csv, .txt, or text-based .pdf statement file.');
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
          accept=".csv,.txt,.pdf"
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
              {isProcessingPdf ? 'Extracting Statement PDF...' : 'Upload Statement CSV or PDF'}
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
              Drag and drop your bank or card statement here, or click to browse.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" size="sm" className="gap-1 text-[11px]">
              <FileSpreadsheet className="w-3 h-3 text-[hsl(var(--primary))]" /> CSV / TXT
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
            Choose Statement File
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
            Sweep reads your CSV or PDF right here in your browser. Nothing is uploaded. Other
            charges are ignored, and only the subscriptions you pick get added.
          </p>
        </div>
      </div>

      {/* Sample Statement Testing */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]">
        <span>Want to test without uploading real bank statements?</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDownloadSample}
            className="text-xs gap-1"
          >
            <Download className="w-3.5 h-3.5" /> Download Sample CSV
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
