'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  CustomBankRule,
  getCustomBankRules,
  saveCustomBankRule,
  deleteCustomBankRule,
  toggleCustomBankRule,
  testCustomRule,
  exportCustomBankRulesJson,
  validateBankRulesJson,
  applyBankRulesImport,
  RuleImportValidationResult,
} from '@/lib/utils/statementMappingMemory';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Play,
  Sliders,
  Download,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function CustomBankRulesManager() {
  const [rules, setRules] = useState<CustomBankRule[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [bankName, setBankName] = useState('');
  const [filePattern, setFilePattern] = useState('');
  const [headerKeywords, setHeaderKeywords] = useState('');
  const [headerRegex, setHeaderRegex] = useState('');

  // Test state
  const [testFileName, setTestFileName] = useState('');
  const [testHeaders, setTestHeaders] = useState('');
  const [testResult, setTestResult] = useState<{ matches: boolean; matchedBy: string[] } | null>(
    null
  );

  // Import / Export state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importValidation, setImportValidation] = useState<RuleImportValidationResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRules = () => {
    setRules(getCustomBankRules());
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleStartAdd = () => {
    setEditingId(null);
    setBankName('');
    setFilePattern('');
    setHeaderKeywords('');
    setHeaderRegex('');
    setTestResult(null);
    setIsEditing(true);
  };

  const handleStartEdit = (rule: CustomBankRule) => {
    setEditingId(rule.id);
    setBankName(rule.bankName);
    setFilePattern(rule.filePattern || '');
    setHeaderKeywords(rule.headerKeywords.join(', '));
    setHeaderRegex(rule.headerRegexPattern || '');
    setTestResult(null);
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) return;

    const keywords = headerKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    saveCustomBankRule({
      id: editingId || undefined,
      bankName: bankName.trim(),
      filePattern: filePattern.trim() || undefined,
      headerKeywords: keywords,
      headerRegexPattern: headerRegex.trim() || undefined,
      isEnabled: true,
    });

    setIsEditing(false);
    loadRules();
  };

  const handleDelete = (id: string) => {
    deleteCustomBankRule(id);
    loadRules();
  };

  const handleToggle = (id: string, current: boolean) => {
    toggleCustomBankRule(id, !current);
    loadRules();
  };

  const handleRunTest = () => {
    const keywords = headerKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const headersArray = testHeaders
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);

    const tempRule: CustomBankRule = {
      id: 'test',
      bankName: bankName || 'Test Provider',
      filePattern: filePattern.trim() || undefined,
      headerKeywords: keywords,
      headerRegexPattern: headerRegex.trim() || undefined,
      isEnabled: true,
      createdAt: '',
      updatedAt: '',
    };

    const res = testCustomRule(tempRule, headersArray, testFileName);
    setTestResult(res);
  };

  // Export JSON Handler
  const handleExport = () => {
    const json = exportCustomBankRulesJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sweep-custom-bank-rules-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON Handlers
  const handleJsonFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
      const validation = validateBankRulesJson(text);
      setImportValidation(validation);
    };
    reader.readAsText(file);
  };

  const handleJsonTextChange = (text: string) => {
    setImportJsonText(text);
    if (text.trim()) {
      const validation = validateBankRulesJson(text);
      setImportValidation(validation);
    } else {
      setImportValidation(null);
    }
  };

  const handleApplyImport = () => {
    if (!importValidation?.valid || !importValidation.payload?.rules) return;

    const result = applyBankRulesImport(importValidation.payload.rules, importMode);
    alert(
      `Bank Rules Import Complete:\n${result.added} rule(s) added, ${result.updated} updated. Total active: ${result.total}.`
    );
    setIsImportModalOpen(false);
    setImportJsonText('');
    setImportValidation(null);
    loadRules();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <CardTitle>Custom Bank Recognition Rules</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={rules.length === 0}
                className="gap-1 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export Rules
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImportModalOpen(true)}
                className="gap-1 text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Rules
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleStartAdd}
                className="gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Rule
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Define custom pattern matchers for regional credit unions and international banks. Custom
            rules execute with high priority before built-in bank templates.
          </p>

          {/* Rule Editor Drawer / Card */}
          {isEditing ? (
            <form
              onSubmit={handleSave}
              className="p-4 rounded-xl border border-primary/30 bg-surface/50 space-y-3.5"
            >
              <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                {editingId ? 'Edit Bank Recognition Rule' : 'New Bank Recognition Rule'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Bank / Provider Name *"
                  placeholder="e.g. First Tech Federal CU"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />

                <Input
                  label="Filename Substring or Pattern"
                  placeholder="e.g. firsttech_.*\.csv or firsttech"
                  value={filePattern}
                  onChange={(e) => setFilePattern(e.target.value)}
                  helperText="Matches statement file names"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Required Header Keywords (comma-separated)"
                  placeholder="e.g. trans_date, description, debit"
                  value={headerKeywords}
                  onChange={(e) => setHeaderKeywords(e.target.value)}
                  helperText="All keywords must exist in the CSV headers"
                />

                <Input
                  label="Optional Header Regex Pattern"
                  placeholder="e.g. (posted_date|booking_date)"
                  value={headerRegex}
                  onChange={(e) => setHeaderRegex(e.target.value)}
                  helperText="Evaluated safely against joined headers"
                />
              </div>

              {/* In-Line Rule Sandbox Tester */}
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                  <span>Rule Verification Sandbox</span>
                  <button
                    type="button"
                    onClick={handleRunTest}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3" /> Test Matcher
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Sample filename (e.g. firsttech_export.csv)"
                    value={testFileName}
                    onChange={(e) => setTestFileName(e.target.value)}
                    className="sweep-input text-xs py-1 px-2"
                  />
                  <input
                    type="text"
                    placeholder="Sample headers (e.g. trans_date, description, debit, balance)"
                    value={testHeaders}
                    onChange={(e) => setTestHeaders(e.target.value)}
                    className="sweep-input text-xs py-1 px-2"
                  />
                </div>

                {testResult ? (
                  <div
                    className={cn(
                      'p-2 rounded text-[11px] flex items-center gap-1.5',
                      testResult.matches
                        ? 'bg-success-subtle text-success font-medium'
                        : 'bg-danger-subtle text-danger'
                    )}
                  >
                    {testResult.matches ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Match Success! {testResult.matchedBy.join(' · ')}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Rule did not match the test inputs.</span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Rule
                </Button>
              </div>
            </form>
          ) : null}

          {/* Existing Rules List */}
          {rules.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border text-center text-muted-foreground">
              No custom bank rules defined. Sweep uses built-in fingerprints for major banks
              automatically.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">
                        {rule.bankName}
                      </span>
                      <Badge variant={rule.isEnabled ? 'success' : 'muted'} size="sm">
                        {rule.isEnabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap font-mono">
                      {rule.filePattern ? <span>File: {rule.filePattern}</span> : null}
                      {rule.headerKeywords.length > 0 ? (
                        <span>Keywords: [{rule.headerKeywords.join(', ')}]</span>
                      ) : null}
                      {rule.headerRegexPattern ? (
                        <span>Regex: /{rule.headerRegexPattern}/</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(rule.id, rule.isEnabled)}
                      className="text-xs"
                    >
                      {rule.isEnabled ? 'Disable' : 'Enable'}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(rule)}
                      className="text-xs text-primary"
                    >
                      Edit
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      title="Delete rule"
                      className="p-1.5 text-muted-foreground hover:text-danger transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Custom Rules Modal */}
      {isImportModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-bank-rules-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="bg-card border border-border rounded-modal shadow-modal w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <h3 id="import-bank-rules-title" className="text-sm font-bold text-foreground">
                  Import Custom Bank Rules JSON
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload a previously exported <code className="font-mono bg-surface-muted px-1 py-0.5 rounded">sweep-custom-bank-rules-*.json</code>{' '}
              backup or paste JSON payload below.
            </p>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleJsonFileSelected}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-1.5 text-xs justify-center"
              >
                <Upload className="w-3.5 h-3.5" /> Select JSON File from Device
              </Button>

              <textarea
                value={importJsonText}
                onChange={(e) => handleJsonTextChange(e.target.value)}
                placeholder="Or paste JSON payload here..."
                rows={4}
                className="sweep-input w-full font-mono text-[11px] p-2 resize-none"
              />
            </div>

            {/* Validation Feedback */}
            {importValidation ? (
              <div
                className={cn(
                  'p-3 rounded-xl border text-xs space-y-1.5',
                  importValidation.valid
                    ? 'bg-success-subtle border-success/30 text-success'
                    : 'bg-danger-subtle border-danger/30 text-danger'
                )}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  {importValidation.valid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Valid Sweep Bank Rules Package</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Validation Failed</span>
                    </>
                  )}
                </div>

                {importValidation.valid ? (
                  <div className="text-[11px] space-y-1 pt-1 text-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant="success" size="sm">
                        {importValidation.newCount} New
                      </Badge>
                      <Badge variant="warning" size="sm">
                        {importValidation.updateCount} Updates
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {importValidation.identicalCount} Unchanged
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Total rules in payload: {importValidation.payload?.rules.length}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed">{importValidation.error}</p>
                )}
              </div>
            ) : null}

            {/* Conflict Mode Selection */}
            {importValidation?.valid ? (
              <div className="space-y-2 pt-1 border-t border-border">
                <label className="text-xs font-semibold text-foreground">
                  Import Conflict Strategy
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={cn(
                      'p-2.5 rounded-lg border cursor-pointer flex items-center gap-2',
                      importMode === 'merge'
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-primary accent-primary"
                    />
                    <div>
                      <div className="font-bold text-foreground">Merge (Safe)</div>
                      <div className="text-[11px] text-muted-foreground">
                        Keep existing rules and update matches
                      </div>
                    </div>
                  </label>

                  <label
                    className={cn(
                      'p-2.5 rounded-lg border cursor-pointer flex items-center gap-2',
                      importMode === 'replace'
                        ? 'border-danger bg-danger/5'
                        : 'border-border'
                    )}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-danger accent-danger"
                    />
                    <div>
                      <div className="font-bold text-foreground">Replace All</div>
                      <div className="text-[11px] text-muted-foreground">
                        Overwrite all current custom rules
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsImportModalOpen(false)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!importValidation?.valid}
                onClick={handleApplyImport}
                className="gap-1 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Apply {importMode === 'replace' ? 'Replace' : 'Merge'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
