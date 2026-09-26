'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { CsvColumnMapping, NormalizedTransaction, RecurringCandidate } from '@/lib/types';
import {
  parseRawCsv,
  autoDetectColumnMapping,
  normalizeTransactions,
} from '@/lib/utils/csvParser';
import {
  findSavedMapping,
  saveConfirmedMapping,
  detectBankSource,
  saveCustomBankRule,
} from '@/lib/utils/statementMappingMemory';
import {
  detectMultiAccountGroups,
  AccountGroup,
} from '@/lib/utils/multiAccountDetector';
import { parsePdfStatement } from '@/lib/utils/pdfParser';
import { detectRecurringCandidates } from '@/lib/utils/recurringDetector';
import dynamic from 'next/dynamic';
import { StatementDropzone } from '@/components/import/CsvDropzone';

const AccountGroupSelector = dynamic(
  () => import('@/components/import/AccountGroupSelector').then((m) => m.AccountGroupSelector),
  { ssr: false }
);
const ColumnMapper = dynamic(
  () => import('@/components/import/ColumnMapper').then((m) => m.ColumnMapper),
  { ssr: false }
);
const CandidateReviewCard = dynamic(
  () => import('@/components/import/CandidateReviewCard').then((m) => m.CandidateReviewCard),
  { ssr: false }
);
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AnimatedCurrency } from '@/components/ui/AnimatedCurrency';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Plus,
  Inbox,
  AlertCircle,
  FileType,
  Layers,
  Coins,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ImportStep = 'upload' | 'account_select' | 'map' | 'review' | 'success';
type ReviewFilter = 'all' | 'selected' | 'unselected' | 'flagged';

export default function StatementImportPage() {
  const router = useRouter();
  const { subscriptions, categories, profile, addSubscription } = useSubscriptions();

  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'csv' | 'pdf'>('csv');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [filteredCsvRows, setFilteredCsvRows] = useState<Record<string, string>[]>([]);
  
  // Multi-account split-batch session state
  const [accountColumn, setAccountColumn] = useState<string | null>(null);
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | 'ALL'>('ALL');
  const [completedGroupKeys, setCompletedGroupKeys] = useState<string[]>([]);
  const [groupCurrencies, setGroupCurrencies] = useState<Record<string, string>>({});
  const [sessionImportedTotal, setSessionImportedTotal] = useState(0);

  const [columnMapping, setColumnMapping] = useState<CsvColumnMapping>({
    dateColumn: '',
    descriptionColumn: '',
    amountColumn: '',
  });

  const [normalizedTransactions, setNormalizedTransactions] = useState<NormalizedTransaction[]>([]);
  const [candidates, setCandidates] = useState<RecurringCandidate[]>([]);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedBatchCount, setImportedBatchCount] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [isRememberedFormat, setIsRememberedFormat] = useState(false);
  const [bankName, setBankName] = useState('Custom Statement Format');

  const profileCurrency = profile?.currency_preference || 'USD';
  const activeBatchCurrency =
    selectedGroupKey !== 'ALL'
      ? groupCurrencies[selectedGroupKey] || profileCurrency
      : profileCurrency;

  const isMultiAccountBatch = accountGroups.length > 1;
  const currentBatchNum = completedGroupKeys.length + 1;
  const totalBatchNum = accountGroups.length;

  const hasComparisonData =
    (isMultiAccountBatch && completedGroupKeys.length >= 1) ||
    (!isMultiAccountBatch && subscriptions.length > 0);

  const trendBadgeText = isMultiAccountBatch
    ? `Statement ${currentBatchNum} of ${totalBatchNum}: price changes will be checked`
    : 'Checking for price changes against your current subscriptions';

  // Step 1A: CSV File Loaded
  const handleCsvLoaded = (csvContent: string, name: string) => {
    setUploadError(null);
    setFileName(name);
    setFileType('csv');
    const { headers, rows } = parseRawCsv(csvContent);

    if (headers.length === 0 || rows.length === 0) {
      setUploadError('The CSV file could not be parsed. Please check the file structure.');
      return;
    }

    setCsvHeaders(headers);
    setCsvRows(rows);
    setCompletedGroupKeys([]);
    setSessionImportedTotal(0);

    // Check for multi-account CSV
    const multiAccount = detectMultiAccountGroups(headers, rows, profileCurrency);
    if (multiAccount.hasMultipleAccounts && multiAccount.groups.length > 1) {
      setAccountColumn(multiAccount.accountColumn);
      setAccountGroups(multiAccount.groups);
      const currMap: Record<string, string> = {};
      multiAccount.groups.forEach((g) => {
        currMap[g.accountKey] = g.customCurrency || g.inferredCurrency || profileCurrency;
      });
      setGroupCurrencies(currMap);
      setSelectedGroupKey(multiAccount.groups[0].accountKey);
      setFilteredCsvRows(rows);
      setStep('account_select');
      return;
    }

    // Standard single-account flow
    setFilteredCsvRows(rows);
    const saved = findSavedMapping(headers, name);
    if (saved) {
      setColumnMapping(saved.mapping);
      setBankName(saved.bankName);
      setIsRememberedFormat(true);
    } else {
      const detectedMapping = autoDetectColumnMapping(headers);
      const detectedBank = detectBankSource(headers, name);
      setColumnMapping(detectedMapping);
      setBankName(detectedBank);
      setIsRememberedFormat(false);
    }
    setStep('map');
  };

  // Step 1B: Account Group Selected
  const startAccountBatch = (groupKey: string | 'ALL') => {
    setSelectedGroupKey(groupKey);
    let rowsToUse = csvRows;
    if (groupKey !== 'ALL' && accountColumn) {
      rowsToUse = csvRows.filter((r) => r[accountColumn] === groupKey);
    }
    setFilteredCsvRows(rowsToUse);

    const saved = findSavedMapping(csvHeaders, fileName);
    if (saved) {
      setColumnMapping(saved.mapping);
      setBankName(saved.bankName);
      setIsRememberedFormat(true);
    } else {
      const detectedMapping = autoDetectColumnMapping(csvHeaders);
      const detectedBank = detectBankSource(csvHeaders, fileName);
      setColumnMapping(detectedMapping);
      setBankName(detectedBank);
      setIsRememberedFormat(false);
    }
    setStep('map');
  };

  const handleAccountGroupConfirmed = () => {
    startAccountBatch(selectedGroupKey);
  };

  const handleUpdateGroupCurrency = (groupKey: string, curr: string) => {
    setGroupCurrencies((prev) => ({
      ...prev,
      [groupKey]: curr,
    }));
  };

  // Step 1C: PDF File Loaded
  const handlePdfLoaded = async (file: File) => {
    setUploadError(null);
    setFileName(file.name);
    setFileType('pdf');
    setIsProcessingPdf(true);

    try {
      const result = await parsePdfStatement(file);

      if (!result.success || result.transactions.length === 0) {
        setUploadError(
          result.error ||
            'Could not extract transactions from this PDF. Please ensure it is a digital text statement rather than a scanned image.'
        );
        setIsProcessingPdf(false);
        return;
      }

      setNormalizedTransactions(result.transactions);

      const detected = detectRecurringCandidates(result.transactions, categories, profileCurrency);
      setCandidates(detected);
      setStep('review');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process PDF statement.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Step 2: Mapping Confirmed (CSV)
  const handleConfirmMapping = (
    confirmedMapping: CsvColumnMapping,
    customBankName?: string,
    saveAsRule: boolean = false
  ) => {
    setColumnMapping(confirmedMapping);
    const finalBankName = customBankName || bankName || 'Custom Statement Format';
    setBankName(finalBankName);

    saveConfirmedMapping(csvHeaders, confirmedMapping, finalBankName, fileName);

    if (saveAsRule && customBankName && customBankName !== 'Custom Statement Format') {
      const keywords: string[] = [];
      if (confirmedMapping.dateColumn) keywords.push(confirmedMapping.dateColumn);
      if (confirmedMapping.descriptionColumn) keywords.push(confirmedMapping.descriptionColumn);
      if (confirmedMapping.amountColumn) keywords.push(confirmedMapping.amountColumn);

      saveCustomBankRule({
        bankName: customBankName,
        headerKeywords: keywords,
        isEnabled: true,
      });
    }

    const normalized = normalizeTransactions(
      filteredCsvRows,
      confirmedMapping
    );
    setNormalizedTransactions(normalized);

    const detected = detectRecurringCandidates(normalized, categories, activeBatchCurrency);
    setCandidates(detected);
    setStep('review');
  };

  // Step 3: Candidate Selection Controls
  const toggleCandidateSelect = (id: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleUpdateCandidate = (id: string, updates: Partial<RecurringCandidate>) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setCandidates((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  // Step 4: Import Execution
  const handleExecuteImport = async () => {
    const selected = candidates.filter((c) => c.selected);
    if (selected.length === 0) return;

    setIsImporting(true);
    try {
      for (const item of selected) {
        const nextDate = item.lastDate
          ? new Date(new Date(item.lastDate).getTime() + 30 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0]
          : new Date().toISOString().split('T')[0];

        await addSubscription({
          name: item.merchantName,
          amount: item.amount,
          currency: item.currency,
          billing_cycle: item.billingCycle,
          status: 'active',
          category_id: item.suggestedCategoryId,
          start_date: item.firstDate || new Date().toISOString().split('T')[0],
          next_renewal_date: nextDate,
          is_trial: false,
          trial_end_date: null,
          reminder_offsets: profile?.default_reminder_days || [7, 3, 1],
          value_rating: item.valueRating,
        });
      }

      setImportedBatchCount(selected.length);
      setSessionImportedTotal((prev) => prev + selected.length);

      if (selectedGroupKey !== 'ALL') {
        setCompletedGroupKeys((prev) =>
          prev.includes(selectedGroupKey) ? prev : [...prev, selectedGroupKey]
        );
      }

      setStep('success');
    } catch (err: any) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Next account batch continuation
  const remainingGroups = accountGroups.filter(
    (g) => !completedGroupKeys.includes(g.accountKey) && g.accountKey !== selectedGroupKey
  );
  const nextPendingGroup = remainingGroups[0];

  const handleProceedToNextAccount = () => {
    if (!nextPendingGroup) return;
    startAccountBatch(nextPendingGroup.accountKey);
  };

  // Selection metrics
  const selectedCount = candidates.filter((c) => c.selected).length;
  const unselectedCount = candidates.filter((c) => !c.selected).length;
  const flaggedCount = candidates.filter((c) => c.confidence === 'low').length;
  const selectedMonthlyTotal = candidates
    .filter((c) => c.selected)
    .reduce((acc, c) => acc + c.amount, 0);

  // Filtered candidate list
  const filteredCandidates = candidates.filter((c) => {
    if (reviewFilter === 'selected') return c.selected;
    if (reviewFilter === 'unselected') return !c.selected;
    if (reviewFilter === 'flagged') return c.confidence === 'low';
    return true;
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Link
            href="/subscriptions"
            aria-label="Back to subscriptions"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Import a bank statement
            </h1>
            <p className="text-xs text-muted-foreground">
              Upload a CSV or PDF statement and Sweep will find your subscriptions
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className={step === 'upload' ? 'text-primary font-bold' : ''}>
            1. Upload
          </span>
          {step === 'account_select' || accountGroups.length > 1 ? (
            <>
              <span>→</span>
              <span className={step === 'account_select' ? 'text-primary font-bold' : ''}>
                Account
              </span>
            </>
          ) : null}
          <span>→</span>
          {fileType === 'csv' ? (
            <>
              <span className={step === 'map' ? 'text-primary font-bold' : ''}>
                Map
              </span>
              <span>→</span>
            </>
          ) : null}
          <span className={step === 'review' ? 'text-primary font-bold' : ''}>
            Preview
          </span>
        </div>
      </div>

      {/* Upload Error Banner */}
      {uploadError ? (
        <div className="p-4 rounded-xl bg-danger-subtle border border-danger/30 text-xs text-danger flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Couldn't read the file</div>
            <p className="leading-relaxed text-[11px]">{uploadError}</p>
          </div>
        </div>
      ) : null}

      {/* STEP 1: Upload */}
      {step === 'upload' ? (
        <StatementDropzone
          onCsvLoaded={handleCsvLoaded}
          onPdfLoaded={handlePdfLoaded}
          isProcessingPdf={isProcessingPdf}
        />
      ) : null}

      {/* STEP 1.5: Multi-Account Selector */}
      {step === 'account_select' && accountColumn ? (
        <AccountGroupSelector
          accountColumn={accountColumn}
          groups={accountGroups}
          totalRows={csvRows.length}
          selectedGroupKey={selectedGroupKey}
          completedGroupKeys={completedGroupKeys}
          groupCurrencies={groupCurrencies}
          onUpdateGroupCurrency={handleUpdateGroupCurrency}
          onSelectGroup={setSelectedGroupKey}
          onContinue={handleAccountGroupConfirmed}
          onBack={() => setStep('upload')}
          onFinishSession={() => router.push('/subscriptions')}
        />
      ) : null}

      {/* STEP 2: Map Columns (CSV Only) */}
      {step === 'map' ? (
        <ColumnMapper
          headers={csvHeaders}
          previewRows={filteredCsvRows}
          initialMapping={columnMapping}
          isRememberedFormat={isRememberedFormat}
          bankName={bankName}
          batchCurrency={activeBatchCurrency}
          onConfirmMapping={handleConfirmMapping}
          onBack={() => (accountGroups.length > 1 ? setStep('account_select') : setStep('upload'))}
        />
      ) : null}

      {/* STEP 3: Interactive Review & Selection Preview */}
      {step === 'review' ? (
        <div className="space-y-6">
          {/* Summary KPI Bar */}
          <div className="p-4 sm:p-5 rounded-xl bg-card border border-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-2 flex-wrap">
                  {fileType === 'pdf' ? (
                    <FileType className="w-4 h-4 text-primary" />
                  ) : null}
                  <span>
                    {candidates.length} subscription{candidates.length === 1 ? '' : 's'} found
                  </span>
                  <Badge variant="outline" size="sm" className="font-mono flex items-center gap-1">
                    <Coins className="w-3 h-3 text-primary" /> {activeBatchCurrency}
                  </Badge>

                  {/* Multi-statement Trend Analysis Badge */}
                  {hasComparisonData ? (
                    <Badge variant="success" size="sm" className="gap-1 font-mono text-[10px] shadow-xs">
                      <TrendingUp className="w-3 h-3" />
                      {trendBadgeText}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Scanned {normalizedTransactions.length} statement transactions from{' '}
                  <span className="font-mono">{fileName}</span>
                  {selectedGroupKey !== 'ALL' && accountColumn ? (
                    <span className="text-primary font-semibold ml-1">
                      (Account: {selectedGroupKey})
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-sm sm:text-base font-bold text-foreground">
                  +<AnimatedCurrency value={selectedMonthlyTotal} currency={activeBatchCurrency} />
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedCount} of {candidates.length} selected to save
                </div>
              </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer',
                    reviewFilter === 'all'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All ({candidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('selected')}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer',
                    reviewFilter === 'selected'
                      ? 'bg-card text-primary shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Selected ({selectedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('unselected')}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer',
                    reviewFilter === 'unselected'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Excluded ({unselectedCount})
                </button>
                {flaggedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setReviewFilter('flagged')}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer',
                      reviewFilter === 'flagged'
                        ? 'bg-card text-warning shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-warning'
                    )}
                  >
                    Review Needed ({flaggedCount})
                  </button>
                ) : null}
              </div>

              {/* Bulk Toggle Controls */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-border">·</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-[11px] text-muted-foreground hover:underline font-medium cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          </div>

          {/* Candidates List or Empty State */}
          {candidates.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-card rounded-xl border border-border">
              <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  No recurring patterns detected
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  We could not find repeated recurring charges in this account batch. You can always add
                  subscriptions manually.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => (accountGroups.length > 1 ? setStep('account_select') : setStep('upload'))}
                className="text-xs"
              >
                {accountGroups.length > 1 ? 'Choose Different Account' : 'Upload Different Statement'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCandidates.map((candidate) => {
                const existingMatch = subscriptions.find(
                  (s) => s.name.toLowerCase().trim() === candidate.merchantName.toLowerCase().trim()
                );

                return (
                  <CandidateReviewCard
                    key={candidate.id}
                    candidate={candidate}
                    categories={categories}
                    existingSubscription={existingMatch}
                    onToggleSelect={toggleCandidateSelect}
                    onUpdateCandidate={handleUpdateCandidate}
                  />
                );
              })}

              {filteredCandidates.length === 0 ? (
                <div className="p-8 text-center bg-surface/40 rounded-xl border border-border text-xs text-muted-foreground">
                  No candidates match the selected filter.
                </div>
              ) : null}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => (fileType === 'csv' ? setStep('map') : setStep('upload'))}
            >
              {fileType === 'csv' ? 'Back to Mapping' : 'Back to Upload'}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={selectedCount === 0}
              isLoading={isImporting}
              onClick={handleExecuteImport}
              className="gap-1.5 shadow-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Import {selectedCount} Selected Subscription{selectedCount === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* STEP 4: Success */}
      {step === 'success' ? (
        <Card className="text-center py-10 px-4 space-y-5 max-w-lg mx-auto">
          <div className="w-14 h-14 mx-auto rounded-full bg-success-subtle flex items-center justify-center text-success shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">
              {accountGroups.length > 1 && remainingGroups.length > 0
                ? 'Account imported'
                : 'All done'}
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Added <strong>{importedBatchCount} subscription{importedBatchCount === 1 ? '' : 's'}</strong>{' '}
              from {selectedGroupKey !== 'ALL' ? `Account (${selectedGroupKey})` : 'your statement'} to
              the Sweep ledger in <strong className="font-mono">{activeBatchCurrency}</strong>.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
              {hasComparisonData ? (
                <Badge variant="success" size="sm" className="gap-1 font-mono">
                  <TrendingUp className="w-3 h-3" />
                  {trendBadgeText}
                </Badge>
              ) : null}
              {sessionImportedTotal > importedBatchCount ? (
                <Badge variant="outline" size="sm">
                  {sessionImportedTotal} total subscriptions added this session
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Consecutive Multi-Account Batch Next Action */}
          {accountGroups.length > 1 && remainingGroups.length > 0 && selectedGroupKey !== 'ALL' ? (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  More accounts in this file
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                You have <strong>{remainingGroups.length} remaining sub-account{remainingGroups.length === 1 ? '' : 's'}</strong>{' '}
                in <span className="font-mono">{fileName}</span> ({nextPendingGroup.label} with {nextPendingGroup.rowCount} charges).
              </p>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleProceedToNextAccount}
                  className="gap-1.5 font-semibold"
                >
                  Continue with {nextPendingGroup.label} <ArrowRight className="w-3.5 h-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('account_select')}
                  className="text-xs"
                >
                  View All Batches
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-3 pt-2">
            <ButtonLink href="/subscriptions" variant="primary" size="md">
              View Subscriptions
            </ButtonLink>

            <ButtonLink href="/" variant="outline" size="md">
              Go to Dashboard
            </ButtonLink>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
