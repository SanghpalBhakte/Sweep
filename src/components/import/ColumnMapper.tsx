'use client';

import React, { useState } from 'react';
import { CsvColumnMapping } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Table, ArrowRight, AlertCircle, Sparkles, RefreshCw, Building, Coins } from 'lucide-react';
import { autoDetectColumnMapping } from '@/lib/utils/csvParser';

interface ColumnMapperProps {
  headers: string[];
  previewRows: Record<string, string>[];
  initialMapping: CsvColumnMapping;
  isRememberedFormat?: boolean;
  bankName?: string;
  batchCurrency?: string;
  onConfirmMapping: (
    mapping: CsvColumnMapping,
    customBankName?: string,
    saveAsCustomRule?: boolean
  ) => void;
  onBack: () => void;
}

export function ColumnMapper({
  headers,
  previewRows,
  initialMapping,
  isRememberedFormat = false,
  bankName = 'Custom Statement Format',
  batchCurrency = 'USD',
  onConfirmMapping,
  onBack,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<CsvColumnMapping>(initialMapping);
  const [isRemembered, setIsRemembered] = useState(isRememberedFormat);
  const [customBankLabel, setCustomBankLabel] = useState(
    bankName === 'Custom Statement Format' ? '' : bankName
  );

  const isUnrecognized = !isRemembered && (!bankName || bankName === 'Custom Statement Format');
  const [saveAsCustomRule, setSaveAsCustomRule] = useState(isUnrecognized);
  const [error, setError] = useState<string | null>(null);

  const handleResetToAuto = () => {
    const auto = autoDetectColumnMapping(headers);
    setMapping(auto);
    setIsRemembered(false);
  };

  const handleContinue = () => {
    if (!mapping.dateColumn) {
      setError('Please select a Date column.');
      return;
    }
    if (!mapping.descriptionColumn) {
      setError('Please select a Description or Merchant column.');
      return;
    }
    if (!mapping.amountColumn && !mapping.debitColumn) {
      setError('Please select an Amount or Debit column.');
      return;
    }

    setError(null);
    const finalBankLabel = customBankLabel.trim() || 'Custom Statement Format';
    onConfirmMapping(mapping, finalBankLabel, saveAsCustomRule);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">
            Confirm Statement Column Mapping
          </h2>
          <Badge variant="outline" size="sm" className="font-mono flex items-center gap-1">
            <Coins className="w-3 h-3" /> Account Currency: {batchCurrency}
          </Badge>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Verify or adjust the column mappings below to ensure accurate recurring charge detection.
        </p>
      </div>

      {/* Remembered / Detected Format Banner */}
      {isRemembered ? (
        <div className="p-3.5 rounded-xl bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.25)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              <strong>Recognized {customBankLabel || 'Statement'} Layout:</strong> Applied your saved column mapping.
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetToAuto}
            className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1 hover:underline shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Reset to Default
          </button>
        </div>
      ) : customBankLabel && customBankLabel !== 'Custom Statement Format' ? (
        <div className="p-3 rounded-xl bg-[hsl(var(--surface)/0.6)] border border-[hsl(var(--border))] flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
          <span>
            Detected potential <strong>{customBankLabel}</strong> format. Verify column assignments below.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="p-3 text-xs bg-[hsl(var(--danger-subtle))] border border-[hsl(var(--danger)/0.3)] text-[hsl(var(--danger))] rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Mapping Selectors */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-[hsl(var(--primary))]" />
            <CardTitle>Column Definitions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Transaction Date *"
              value={mapping.dateColumn}
              onChange={(e) => {
                setMapping({ ...mapping, dateColumn: e.target.value });
                setIsRemembered(false);
              }}
              helperText="e.g. Posted Date or Date"
            >
              <option value="">-- Select Date Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>

            <Select
              label="Description / Merchant *"
              value={mapping.descriptionColumn}
              onChange={(e) => {
                setMapping({ ...mapping, descriptionColumn: e.target.value });
                setIsRemembered(false);
              }}
              helperText="e.g. Description, Payee, Name"
            >
              <option value="">-- Select Merchant Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>

            <Select
              label="Amount / Charge *"
              value={mapping.amountColumn}
              onChange={(e) => {
                setMapping({ ...mapping, amountColumn: e.target.value });
                setIsRemembered(false);
              }}
              helperText="e.g. Amount, Debit, Spent"
            >
              <option value="">-- Select Amount Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>

          {/* Bank/Source Identifier Tag & Auto-Rule Save Suggestion */}
          <div className="pt-3 border-t border-[hsl(var(--border))] space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                <label className="text-xs font-semibold text-[hsl(var(--foreground))]">
                  Bank / Statement Profile Label
                </label>
              </div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Label this statement source so Sweep can remember column assignments for this bank layout.
              </p>
              <Input
                value={customBankLabel}
                onChange={(e) => setCustomBankLabel(e.target.value)}
                placeholder="e.g. Coastal Credit Union, N26, Wise Business"
                className="max-w-xs text-xs h-8"
              />
            </div>

            {/* Auto-Rule Suggestion for Unrecognized Layouts */}
            {isUnrecognized ? (
              <div className="p-3 rounded-xl border border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.04)] flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="save-custom-rule-checkbox"
                  checked={saveAsCustomRule}
                  onChange={(e) => setSaveAsCustomRule(e.target.checked)}
                  className="mt-0.5 rounded text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] cursor-pointer"
                />
                <label htmlFor="save-custom-rule-checkbox" className="text-xs space-y-0.5 cursor-pointer">
                  <div className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                    Save this format as a reusable recognition rule?
                  </div>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                    Sweep will remember the header layout ({mapping.dateColumn || 'Date'},{' '}
                    {mapping.descriptionColumn || 'Description'}, {mapping.amountColumn || 'Amount'})
                    to recognize and auto-map future statements from this bank.
                  </p>
                </label>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* CSV Preview Table */}
      <Card className="border border-border/60 shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/40">
          <CardTitle className="text-xs font-medium text-muted-foreground">Statement Data Preview (First 3 Rows)</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 bg-surface/35 text-muted-foreground">
                {headers.map((h) => {
                  const isMapped =
                    h === mapping.dateColumn ||
                    h === mapping.descriptionColumn ||
                    h === mapping.amountColumn;
                  return (
                    <th key={h} className="px-3.5 py-2.5 font-medium whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{h}</span>
                        {isMapped ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ) : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/35">
              {previewRows.slice(0, 3).map((row, rIndex) => (
                <tr key={rIndex} className="hover:bg-surface/30 transition-colors">
                  {headers.map((h) => (
                    <td
                      key={h}
                      className="px-3.5 py-2.5 text-foreground/90 whitespace-nowrap font-mono text-xs tabular-nums"
                    >
                      {row[h] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>

        <Button type="button" variant="primary" size="md" onClick={handleContinue} className="gap-1.5">
          Scan for Subscriptions <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
