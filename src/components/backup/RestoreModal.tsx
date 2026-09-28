'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { BackupValidationResult, SiftBackupData } from '@/lib/types';
import {
  validateBackupJson,
  remapCategoryBenchmarkOverrides,
  findCategorySuggestion,
  resolveCategoryDefaultColor,
} from '@/lib/utils/backup';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  X,
  RefreshCw,
  Layers,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  FolderPlus,
  Sparkles,
  Check,
  RotateCcw,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';

interface RestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export type RestoreOutcomeStatus =
  | 'uuid'
  | 'slug'
  | 'manual'
  | 'collision'
  | 'unmatched';

export interface RestoreOutcomeItem {
  key: string;
  name: string;
  slug?: string;
  benchmark: number;
  status: RestoreOutcomeStatus;
  statusLabel: string;
  details: string;
}

export interface RestoreCompletionSummary {
  subscriptionCount: number;
  mode: 'merge' | 'replace';
  globalBenchmark: number;
  activeOverridesCount: number;
  matchedByUuid: number;
  matchedBySlug: number;
  manuallyRemapped: number;
  skippedCollisionCount: number;
  skippedUnmatchedCount: number;
  items: RestoreOutcomeItem[];
}

export function RestoreModal({ isOpen, onClose, onSuccess }: RestoreModalProps) {
  const {
    subscriptions,
    categories,
    addSubscription,
    addCategory,
    deleteSubscription,
    updateProfile,
  } = useSubscriptions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<BackupValidationResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [manualRemappings, setManualRemappings] = useState<Record<string, string>>({});
  const [restoreResult, setRestoreResult] = useState<RestoreCompletionSummary | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline Category Creation State
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategorySlug, setNewCategorySlug] = useState<string>('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>('#6366f1');
  const [newCategoryIcon, setNewCategoryIcon] = useState<string>('folder');
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);

  // Batch Category Creation & Bulk Inline Editing State
  const [isBatchPreviewOpen, setIsBatchPreviewOpen] = useState(false);
  const [isBatchCreating, setIsBatchCreating] = useState(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);
  const [editedBatchRows, setEditedBatchRows] = useState<
    Record<string, { name: string; slug: string; slugTouched?: boolean }>
  >({});

  // --- Hooks must all be declared before any early return ---

  const batchPreviewItems = useMemo(() => {
    if (!validation?.data?.profile?.category_annual_benchmarks) return [];
    const report = remapCategoryBenchmarkOverrides(
      validation.data.profile.category_annual_benchmarks || {},
      validation.data.categories || [],
      categories
    );

    // Pass 1: Resolve names, raw inputs, and normalized slugs (including user edits)
    const itemsWithValues = report.unmatched.map((un, index) => {
      const backupCat = validation.data?.categories?.find(
        (c) => c.id === un.sourceKey || c.slug === un.sourceSlug
      );
      const defaultName = (backupCat?.name || un.sourceName || un.sourceSlug || 'Category').trim();
      const defaultSlug = (
        backupCat?.slug ||
        un.sourceSlug ||
        defaultName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      )
        .trim()
        .toLowerCase();

      const edited = editedBatchRows[un.sourceKey];
      const name = edited?.name !== undefined ? edited.name : defaultName;
      const rawSlug = edited?.slug !== undefined ? edited.slug : defaultSlug;
      const cleanSlug = rawSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const color = resolveCategoryDefaultColor(backupCat?.color, name || cleanSlug, index);
      const icon = backupCat?.icon || 'folder';
      const isAlreadyRemapped = Boolean(
        manualRemappings[un.sourceKey] && manualRemappings[un.sourceKey] !== 'skip'
      );

      return {
        sourceKey: un.sourceKey,
        name,
        rawSlug,
        slug: cleanSlug,
        color,
        icon,
        configuredBenchmark: un.configuredBenchmark,
        isAlreadyRemapped,
        index,
      };
    });

    // Pass 2: Rigorous validation against active workspace categories AND intra-batch uniqueness
    return itemsWithValues.map((item, idx) => {
      let hasConflict = false;
      let conflictReason: string | null = null;

      if (!item.name.trim()) {
        hasConflict = true;
        conflictReason = 'Name cannot be blank';
      } else if (!item.slug.trim()) {
        hasConflict = true;
        conflictReason = 'Slug cannot be blank';
      } else {
        const workspaceNameConflict = categories.some(
          (c) => c.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );
        const workspaceSlugConflict = categories.some(
          (c) => c.slug && c.slug.trim().toLowerCase() === item.slug
        );

        if (workspaceNameConflict) {
          hasConflict = true;
          conflictReason = `Name "${item.name.trim()}" exists in workspace`;
        } else if (workspaceSlugConflict) {
          hasConflict = true;
          conflictReason = `Slug "${item.slug}" exists in workspace`;
        } else {
          // Check intra-batch duplicate slugs or names
          const batchSlugDup = itemsWithValues.some(
            (other, oIdx) => oIdx !== idx && other.slug === item.slug && other.slug.length > 0
          );
          const batchNameDup = itemsWithValues.some(
            (other, oIdx) =>
              oIdx !== idx &&
              other.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
              other.name.trim().length > 0
          );

          if (batchSlugDup) {
            hasConflict = true;
            conflictReason = `Duplicate slug "${item.slug}" in batch`;
          } else if (batchNameDup) {
            hasConflict = true;
            conflictReason = `Duplicate name "${item.name.trim()}" in batch`;
          }
        }
      }

      return {
        ...item,
        hasConflict,
        conflictReason,
      };
    });
  }, [validation, categories, manualRemappings, editedBatchRows]);

  const creatableBatchItems = useMemo(() => {
    return batchPreviewItems.filter((i) => !i.hasConflict && !i.isAlreadyRemapped);
  }, [batchPreviewItems]);

  if (!isOpen) return null;

  const handleClose = () => {
    setRestoreResult(null);
    setValidation(null);
    setFileName('');
    setManualRemappings({});
    setIsDetailsExpanded(false);
    setCreatingCategoryFor(null);
    setCreateCategoryError(null);
    setIsBatchPreviewOpen(false);
    setBatchSuccessMessage(null);
    setEditedBatchRows({});
    onClose();
  };

  const handleNavigateToCategoryBenchmarks = () => {
    handleClose();
    if (typeof window !== 'undefined') {
      window.location.hash = '#category-benchmarks';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  const handleStartCreateCategory = (unmatched: {
    sourceKey: string;
    sourceName?: string;
    sourceSlug?: string;
  }) => {
    const backupCat = validation?.data?.categories?.find(
      (c) => c.id === unmatched.sourceKey || c.slug === unmatched.sourceSlug
    );
    const initialName = backupCat?.name || unmatched.sourceName || unmatched.sourceSlug || '';
    const initialSlug =
      backupCat?.slug ||
      unmatched.sourceSlug ||
      initialName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    setCreatingCategoryFor(unmatched.sourceKey);
    setNewCategoryName(initialName);
    setNewCategorySlug(initialSlug);
    setNewCategoryColor(resolveCategoryDefaultColor(backupCat?.color, initialName || initialSlug));
    setNewCategoryIcon(backupCat?.icon || 'folder');
    setCreateCategoryError(null);
  };

  const handleConfirmCreateCategory = async (sourceKey: string) => {
    if (!newCategoryName.trim()) {
      setCreateCategoryError('Category name cannot be blank.');
      return;
    }

    const cleanSlug =
      newCategorySlug.trim().toLowerCase() ||
      newCategoryName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const nameCollides = categories.some(
      (c) => c.name.trim().toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    const slugCollides = categories.some(
      (c) => c.slug && c.slug.trim().toLowerCase() === cleanSlug
    );

    if (nameCollides || slugCollides) {
      setCreateCategoryError('A category with this name or slug already exists in your workspace.');
      return;
    }

    setIsCreatingCategory(true);
    setCreateCategoryError(null);

    try {
      const created = await addCategory({
        name: newCategoryName.trim(),
        slug: cleanSlug,
        color: newCategoryColor,
        icon: newCategoryIcon,
      });

      // Automatically map the unmatched item to the newly created category
      setManualRemappings((prev) => ({
        ...prev,
        [sourceKey]: created.id,
      }));
      setCreatingCategoryFor(null);
    } catch (err: any) {
      setCreateCategoryError(err.message || 'Failed to create category.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleUpdateBatchRow = (
    sourceKey: string,
    newName: string,
    newSlug: string,
    slugTouched = false
  ) => {
    setEditedBatchRows((prev) => {
      const prevRow = prev[sourceKey];
      const isSlugTouched = slugTouched || prevRow?.slugTouched;
      let computedSlug = newSlug;

      // If user is editing name and hasn't manually customized slug, auto-generate slug
      if (!isSlugTouched && !slugTouched) {
        computedSlug = newName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      }

      return {
        ...prev,
        [sourceKey]: {
          name: newName,
          slug: computedSlug,
          slugTouched: isSlugTouched,
        },
      };
    });
  };



  const handleExecuteBatchCreate = async () => {
    if (creatableBatchItems.length === 0) return;
    setIsBatchCreating(true);
    try {
      const newMappings: Record<string, string> = { ...manualRemappings };
      let count = 0;
      for (const item of creatableBatchItems) {
        const created = await addCategory({
          name: item.name.trim(),
          slug: item.slug.trim(),
          color: item.color,
          icon: item.icon,
        });
        newMappings[item.sourceKey] = created.id;
        count++;
      }
      setManualRemappings(newMappings);
      setIsBatchPreviewOpen(false);
      setEditedBatchRows({});
      setBatchSuccessMessage(
        `Created ${count} missing ${count === 1 ? 'category' : 'categories'} and mapped ${count === 1 ? 'its' : 'their'} benchmark ${count === 1 ? 'override' : 'overrides'}.`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to create categories in batch.');
    } finally {
      setIsBatchCreating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setManualRemappings({});
    setRestoreResult(null);
    setIsBatchPreviewOpen(false);
    setBatchSuccessMessage(null);
    setEditedBatchRows({});
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Please select a valid .json Sweep backup file.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = validateBackupJson(text);
      if (!result.valid) {
        setError(result.error || 'Invalid backup file structure.');
        setValidation(null);
      } else {
        setValidation(result);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the backup file.');
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!validation?.data) return;
    setIsRestoring(true);
    setError(null);

    try {
      const backup = validation.data;

      // If Replace mode: remove existing subscriptions first
      if (restoreMode === 'replace') {
        for (const sub of subscriptions) {
          await deleteSubscription(sub.id);
        }
      }

      // Restore Subscriptions
      for (const subData of backup.subscriptions) {
        const subSlug = (subData as any).category_slug?.trim().toLowerCase();

        // Deterministic category resolution hierarchy:
        // 1. Manual remapping / batch-created category ID from interactive recovery
        const backupCat = (backup.categories || []).find(
          (c) => c.slug?.trim().toLowerCase() === subSlug
        );
        const remappedId = backupCat ? manualRemappings[backupCat.id] : undefined;

        // 2. Deterministic match in current workspace:
        //    a) Re-mapped ID
        //    b) Primary slug match
        //    c) Historical slug alias match
        const matchedCategory = categories.find((c) => {
          if (remappedId && c.id === remappedId) return true;
          if (subSlug && c.slug && c.slug.trim().toLowerCase() === subSlug) return true;
          if (subSlug && c.slug_aliases?.some((alias) => alias.trim().toLowerCase() === subSlug)) {
            return true;
          }
          return false;
        });

        await addSubscription({
          name: subData.name,
          description: subData.description,
          amount: subData.amount,
          currency: subData.currency || backup.profile?.currency_preference || 'USD',
          billing_cycle: subData.billing_cycle,
          custom_interval_days: subData.custom_interval_days,
          status: subData.status || 'active',
          category_id: matchedCategory?.id || null,
          start_date: subData.start_date || new Date().toISOString().split('T')[0],
          next_renewal_date: subData.next_renewal_date,
          is_trial: subData.is_trial || false,
          trial_end_date: subData.trial_end_date,
          reminder_offsets: subData.reminder_offsets || [7, 3, 1],
          value_rating: subData.value_rating || 'useful',
          cancel_url: subData.cancel_url,
          notes: subData.notes,
        });
      }

      // Restore Profile Preferences if present
      if (backup.profile) {
        const benchmarkReport = remapCategoryBenchmarkOverrides(
          backup.profile.category_annual_benchmarks || {},
          backup.categories || [],
          categories
        );

        // Merge user-confirmed manual remappings on top of auto-mapped benchmarks
        const finalBenchmarks = { ...benchmarkReport.remappedBenchmarks };
        const rawBackupBenchmarks = backup.profile.category_annual_benchmarks || {};

        for (const [sourceKey, targetCatId] of Object.entries(manualRemappings)) {
          if (
            targetCatId &&
            targetCatId !== 'skip' &&
            typeof rawBackupBenchmarks[sourceKey] === 'number'
          ) {
            finalBenchmarks[targetCatId] = rawBackupBenchmarks[sourceKey];
          }
        }

        await updateProfile({
          currency_preference: backup.profile.currency_preference,
          theme_preference: backup.profile.theme_preference,
          default_reminder_days: backup.profile.default_reminder_days,
          annual_benchmark_percent: backup.profile.annual_benchmark_percent ?? 16.7,
          category_annual_benchmarks: finalBenchmarks,
        });

        // Build comprehensive itemized outcome list for all category overrides
        const outcomeItems: RestoreOutcomeItem[] = [];
        let skippedCollisionCount = 0;
        let skippedUnmatchedCount = 0;

        for (const [key, value] of Object.entries(rawBackupBenchmarks)) {
          if (typeof value !== 'number' || isNaN(value)) continue;

          // 1. User manual remapping
          const manualTargetId = manualRemappings[key];
          if (manualTargetId && manualTargetId !== 'skip') {
            const targetCat = categories.find((c) => c.id === manualTargetId);
            const backupCat = (backup.categories || []).find((c) => c.id === key);
            outcomeItems.push({
              key,
              name: backupCat?.name || key,
              slug: backupCat?.slug,
              benchmark: value,
              status: 'manual',
              statusLabel: 'Manually Remapped',
              details: `Remapped to local category "${targetCat?.name || manualTargetId}" during restore review`,
            });
            continue;
          }

          // 2. Exact UUID match
          const exactCat = categories.find((c) => c.id === key);
          if (exactCat) {
            outcomeItems.push({
              key,
              name: exactCat.name,
              slug: exactCat.slug,
              benchmark: value,
              status: 'uuid',
              statusLabel: 'Matched by ID',
              details: 'Automatically matched by unique category ID',
            });
            continue;
          }

          // 3. Slug Fallback
          let sourceSlug: string | undefined;
          let sourceName: string | undefined;
          const backupCat = (backup.categories || []).find((c) => c.id === key);
          if (backupCat) {
            sourceName = backupCat.name;
            if (backupCat.slug) sourceSlug = backupCat.slug.trim().toLowerCase();
          } else if (
            categories.some((c) => c.slug?.trim().toLowerCase() === key.trim().toLowerCase())
          ) {
            sourceSlug = key.trim().toLowerCase();
          }

          if (!sourceSlug) {
            skippedUnmatchedCount++;
            outcomeItems.push({
              key,
              name: sourceName || key,
              benchmark: value,
              status: 'unmatched',
              statusLabel: 'Skipped: No Match',
              details: 'Category was not found in active workspace (defaults to global benchmark)',
            });
            continue;
          }

          const slugMatches = categories.filter(
            (c) => c.slug && c.slug.trim().toLowerCase() === sourceSlug
          );

          if (slugMatches.length === 1) {
            outcomeItems.push({
              key,
              name: sourceName || slugMatches[0].name,
              slug: sourceSlug,
              benchmark: value,
              status: 'slug',
              statusLabel: 'Matched by Slug',
              details: `Automatically matched via unique slug to "${slugMatches[0].name}"`,
            });
            continue;
          } else if (slugMatches.length > 1) {
            skippedCollisionCount++;
            outcomeItems.push({
              key,
              name: sourceName || sourceSlug,
              slug: sourceSlug,
              benchmark: value,
              status: 'collision',
              statusLabel: 'Skipped: Collision',
              details: `Ambiguous match with ${slugMatches.length} local categories (${slugMatches.map((c) => `"${c.name}"`).join(', ')})`,
            });
            continue;
          }

          // Alias match check for renamed categories
          const aliasMatches = categories.filter((c) =>
            c.slug_aliases?.some((a) => a.trim().toLowerCase() === sourceSlug)
          );

          if (aliasMatches.length === 1) {
            outcomeItems.push({
              key,
              name: sourceName || aliasMatches[0].name,
              slug: sourceSlug,
              benchmark: value,
              status: 'slug',
              statusLabel: 'Matched by Slug Alias',
              details: `Automatically matched via historical slug alias to "${aliasMatches[0].name}"`,
            });
          } else if (aliasMatches.length > 1) {
            skippedCollisionCount++;
            outcomeItems.push({
              key,
              name: sourceName || sourceSlug,
              slug: sourceSlug,
              benchmark: value,
              status: 'collision',
              statusLabel: 'Skipped: Alias Collision',
              details: `Ambiguous historical alias match across ${aliasMatches.length} local categories (${aliasMatches.map((c) => `"${c.name}"`).join(', ')})`,
            });
          } else {
            skippedUnmatchedCount++;
            outcomeItems.push({
              key,
              name: sourceName || sourceSlug,
              slug: sourceSlug,
              benchmark: value,
              status: 'unmatched',
              statusLabel: 'Skipped: No Match',
              details: 'Category slug was not found in active workspace (defaults to global benchmark)',
            });
          }
        }

        setRestoreResult({
          subscriptionCount: backup.subscriptions.length,
          mode: restoreMode,
          globalBenchmark: backup.profile.annual_benchmark_percent ?? 16.7,
          activeOverridesCount: Object.keys(finalBenchmarks).length,
          matchedByUuid: outcomeItems.filter((i) => i.status === 'uuid').length,
          matchedBySlug: outcomeItems.filter((i) => i.status === 'slug').length,
          manuallyRemapped: outcomeItems.filter((i) => i.status === 'manual').length,
          skippedCollisionCount,
          skippedUnmatchedCount,
          items: outcomeItems,
        });
      } else {
        setRestoreResult({
          subscriptionCount: backup.subscriptions.length,
          mode: restoreMode,
          globalBenchmark: 16.7,
          activeOverridesCount: 0,
          matchedByUuid: 0,
          matchedBySlug: 0,
          manuallyRemapped: 0,
          skippedCollisionCount: 0,
          skippedUnmatchedCount: 0,
          items: [],
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error('Failed to restore backup:', err);
      setError(`Restore failed: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-bold text-[hsl(var(--foreground))]">
              Restore Sweep Account Backup
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface))]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error ? (
            <div className="p-3 text-xs bg-[hsl(var(--danger-subtle))] border border-[hsl(var(--danger)/0.3)] text-[hsl(var(--danger))] rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          {restoreResult ? (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-success/30 bg-success-subtle text-success flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-success" />
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-foreground">
                    Workspace Restore Complete
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Successfully {restoreResult.mode === 'replace' ? 'replaced' : 'imported and merged'}{' '}
                    {restoreResult.subscriptionCount} subscriptions and updated your preferences.
                  </p>
                </div>
              </div>

              {/* Key Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg border border-border bg-surface/50 text-center">
                  <div className="text-[11px] text-muted-foreground">Subscriptions</div>
                  <div className="text-sm font-bold text-foreground font-mono">
                    {restoreResult.subscriptionCount}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-surface/50 text-center">
                  <div className="text-[11px] text-muted-foreground">Global Benchmark</div>
                  <div className="text-sm font-bold text-foreground font-mono">
                    {restoreResult.globalBenchmark}%
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-border bg-surface/50 text-center col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-muted-foreground">Category Overrides</div>
                  <div className="text-sm font-bold text-foreground font-mono">
                    {restoreResult.activeOverridesCount} Active
                  </div>
                </div>
              </div>

              {/* Category Override Breakdown Chips */}
              {restoreResult.items.length > 0 ? (
                <div className="p-2.5 rounded-xl border border-border bg-surface/30 space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Category Mapping Breakdown
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {restoreResult.matchedByUuid > 0 ? (
                      <Badge variant="primary" size="sm" className="font-mono text-[11px]">
                        {restoreResult.matchedByUuid} by ID
                      </Badge>
                    ) : null}
                    {restoreResult.matchedBySlug > 0 ? (
                      <Badge variant="outline" size="sm" className="font-mono text-[11px]">
                        {restoreResult.matchedBySlug} by Slug Fallback
                      </Badge>
                    ) : null}
                    {restoreResult.manuallyRemapped > 0 ? (
                      <Badge variant="primary" size="sm" className="font-mono text-[11px]">
                        {restoreResult.manuallyRemapped} Manually Remapped
                      </Badge>
                    ) : null}
                    {restoreResult.skippedCollisionCount > 0 ? (
                      <Badge variant="warning" size="sm" className="font-mono text-[11px]">
                        {restoreResult.skippedCollisionCount} Collisions Skipped
                      </Badge>
                    ) : null}
                    {restoreResult.skippedUnmatchedCount > 0 ? (
                      <Badge variant="outline" size="sm" className="font-mono text-[11px] text-muted-foreground">
                        {restoreResult.skippedUnmatchedCount} Unmatched Skipped
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* 1-Click Fix Link Callout for Skipped Items */}
              {restoreResult.skippedCollisionCount + restoreResult.skippedUnmatchedCount > 0 ? (
                <div className="p-3.5 rounded-xl border border-border bg-surface/40 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                      <span>
                        Review Skipped Category Mappings ({restoreResult.skippedCollisionCount + restoreResult.skippedUnmatchedCount})
                      </span>
                    </div>
                    <a
                      href="#category-benchmarks"
                      onClick={handleNavigateToCategoryBenchmarks}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <span>Review skipped category mappings</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    To prevent inaccurate annual savings estimates, these category overrides were skipped without guessing. Subscriptions in these categories will safely use your {restoreResult.globalBenchmark}% global benchmark until you configure them in Settings.
                  </p>
                </div>
              ) : null}

              {/* Expandable Resolution & Itemized Breakdown Accordion */}
              {restoreResult.items.length > 0 ? (
                <div className="p-3 rounded-xl border border-border bg-surface/30 space-y-2">
                  <button
                    type="button"
                    onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                    className="flex items-center justify-between w-full py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>
                      {isDetailsExpanded
                        ? 'Hide itemized category mapping details'
                        : `Show itemized category mapping details (${restoreResult.items.length})`}
                    </span>
                    {isDetailsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isDetailsExpanded ? (
                    <div className="space-y-1.5 pt-1.5 border-t border-border/50 animate-in fade-in duration-150 max-h-56 overflow-y-auto pr-1">
                      {restoreResult.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-card border border-border space-y-1 text-[11px]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-foreground truncate min-w-0 flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {item.slug ? (
                                <span className="font-mono text-muted-foreground font-normal text-[11px]">
                                  ({item.slug})
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant={
                                  item.status === 'uuid' || item.status === 'manual'
                                    ? 'primary'
                                    : item.status === 'slug'
                                      ? 'outline'
                                      : item.status === 'collision'
                                        ? 'warning'
                                        : 'outline'
                                }
                                size="sm"
                                className="font-mono text-[11px]"
                              >
                                {item.statusLabel}
                              </Badge>
                              <span className="font-mono font-semibold text-foreground text-[11px]">
                                {item.benchmark}%
                              </span>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-relaxed">
                            {item.details}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Upload Area */}
              {!validation ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] rounded-xl p-8 text-center cursor-pointer bg-[hsl(var(--surface)/0.3)] hover:bg-[hsl(var(--surface)/0.6)] transition-all space-y-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      Select Sweep JSON Backup File
                    </div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Choose a previously exported <code className="font-mono text-[11px]">sweep-backup-*.json</code> file
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="pointer-events-none text-xs">
                    Browse Files
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Validation Summary Card */}
                  <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface)/0.6)] space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                        <span className="font-bold text-[hsl(var(--foreground))]">
                          Valid Backup Archive Verified
                        </span>
                      </div>
                      <Badge variant="primary" size="sm">
                        {validation.counts?.subscriptions} Subscriptions
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[hsl(var(--border))] text-[11px]">
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Export Date: </span>
                        <span className="font-semibold text-[hsl(var(--foreground))]">
                          {formatDate(validation.data?.exported_at || '')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Account Email: </span>
                        <span className="font-mono text-[hsl(var(--foreground))]">
                          {validation.data?.user_email}
                        </span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Currency: </span>
                        <span className="font-semibold text-[hsl(var(--foreground))]">
                          {validation.data?.profile.currency_preference || 'USD'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[hsl(var(--muted-foreground))]">File: </span>
                        <span className="font-mono text-[hsl(var(--foreground))]">{fileName}</span>
                      </div>
                      {validation.data?.profile?.annual_benchmark_percent !== undefined ? (
                        <div>
                          <span className="text-[hsl(var(--muted-foreground))]">Discount Benchmark: </span>
                          <span className="font-semibold text-[hsl(var(--foreground))]">
                            {validation.data.profile.annual_benchmark_percent}%
                          </span>
                        </div>
                      ) : null}
                      {(() => {
                        if (
                          !validation.data?.profile?.category_annual_benchmarks ||
                          Object.keys(validation.data.profile.category_annual_benchmarks).length === 0
                        ) {
                          return null;
                        }
                        const rep = remapCategoryBenchmarkOverrides(
                          validation.data.profile.category_annual_benchmarks,
                          validation.data.categories || [],
                          categories
                        );
                        const parts: string[] = [];
                        if (rep.matchedByUuid > 0) parts.push(`${rep.matchedByUuid} by ID`);
                        if (rep.matchedBySlug > 0) parts.push(`${rep.matchedBySlug} by slug fallback`);
                        if (rep.skippedAmbiguous > 0) parts.push(`${rep.skippedAmbiguous} ambiguous skipped`);
                        if (rep.skippedMissing > 0) parts.push(`${rep.skippedMissing} missing skipped`);

                        return (
                          <div className="col-span-2 text-[11px] text-[hsl(var(--muted-foreground))] pt-1 border-t border-[hsl(var(--border)/0.5)]">
                            <span className="font-semibold text-[hsl(var(--foreground))]">
                              Category Overrides ({Object.keys(validation.data.profile.category_annual_benchmarks).length}):{' '}
                            </span>
                            <span>{parts.join(', ') || 'No overrides mapped'}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Interactive Category Benchmark Remapping & Recovery Callout */}
                  {(() => {
                    if (!validation.data?.profile?.category_annual_benchmarks) return null;
                    const rep = remapCategoryBenchmarkOverrides(
                      validation.data.profile.category_annual_benchmarks,
                      validation.data.categories || [],
                      categories
                    );

                    if (rep.collisions.length === 0 && rep.unmatched.length === 0) return null;

                    const globalBenchmark = validation.data?.profile?.annual_benchmark_percent ?? 16.7;
                    const manuallyRemappedCount = Object.values(manualRemappings).filter(
                      (v) => v && v !== 'skip'
                    ).length;

                    return (
                      <div className="p-3.5 rounded-xl border border-border bg-surface/40 space-y-3 text-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <Layers className="w-3.5 h-3.5 text-primary" />
                            <span>Interactive Category Recovery (Optional)</span>
                          </div>
                          <Badge
                            variant={manuallyRemappedCount > 0 ? 'primary' : 'outline'}
                            size="sm"
                            className="text-[11px] font-mono"
                          >
                            {manuallyRemappedCount} of {rep.collisions.length + rep.unmatched.length} Remapped
                          </Badge>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          The following category overrides could not be matched automatically and will stay skipped by default. You can optionally remap them to a local workspace category below.
                        </p>

                        {/* Collisions List */}
                        {rep.collisions.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                              Ambiguous Matches ({rep.collisions.length})
                            </span>
                            {rep.collisions.map((col) => {
                              const currentSelection = manualRemappings[col.sourceKey] || 'skip';
                              const suggestion = findCategorySuggestion(col.sourceName || col.sourceSlug, categories);
                              const isCustom = currentSelection !== 'skip';

                              return (
                                <div
                                  key={col.sourceKey}
                                  className={`p-2.5 rounded-lg border transition-all space-y-2 ${
                                    isCustom ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="font-semibold text-foreground text-[11px] truncate flex items-center gap-1.5">
                                        <span>{col.sourceName}</span>
                                        <span className="font-mono text-muted-foreground font-normal text-[11px]">
                                          ({col.sourceSlug})
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        Matched {col.conflictingCategories.length} local categories ({col.conflictingCategories.map((c) => `"${c.name}"`).join(', ')})
                                      </div>
                                    </div>
                                    <Badge
                                      variant={isCustom ? 'primary' : 'warning'}
                                      size="sm"
                                      className="font-mono text-[11px] shrink-0"
                                    >
                                      {col.configuredBenchmark}% {isCustom ? 'Remapped' : 'Skipped'}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-2 pt-1.5 border-t border-border/50">
                                    <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                                      Map to:
                                    </span>
                                    <select
                                      value={currentSelection}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'skip') {
                                          const next = { ...manualRemappings };
                                          delete next[col.sourceKey];
                                          setManualRemappings(next);
                                        } else {
                                          setManualRemappings({
                                            ...manualRemappings,
                                            [col.sourceKey]: val,
                                          });
                                        }
                                      }}
                                      className="w-full h-7 px-2 text-[11px] rounded-md border border-border bg-surface text-foreground font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                      <option value="skip">
                                        Skip (Use global {globalBenchmark}% benchmark)
                                      </option>
                                      {suggestion ? (
                                        <option value={suggestion.category.id}>
                                          Suggested: {suggestion.category.name} ({Math.round(suggestion.similarity * 100)}% match)
                                        </option>
                                      ) : null}
                                      <optgroup label="Available Workspace Categories">
                                        {categories.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    </select>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        {/* Unmatched List */}
                        {rep.unmatched.length > 0 ? (
                          <div className="space-y-2.5 pt-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                                Unmatched Categories ({rep.unmatched.length})
                              </span>
                              {creatableBatchItems.length > 0 && !isBatchPreviewOpen ? (
                                <button
                                  type="button"
                                  onClick={() => setIsBatchPreviewOpen(true)}
                                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer py-0.5"
                                >
                                  <FolderPlus className="w-3.5 h-3.5" />
                                  <span>Create All Missing ({creatableBatchItems.length})</span>
                                </button>
                              ) : null}
                            </div>

                            {/* Batch Success Message */}
                            {batchSuccessMessage ? (
                              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{batchSuccessMessage}</span>
                              </div>
                            ) : null}

                            {/* Batch Preview & Confirmation Card */}
                            {isBatchPreviewOpen ? (
                              <div className="p-3.5 rounded-xl border border-primary/40 bg-card space-y-3 shadow-xs animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                      <FolderPlus className="w-4 h-4 text-primary" />
                                      <span>Create All Missing Categories ({creatableBatchItems.length})</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                      Create {creatableBatchItems.length} workspace categories from imported metadata to restore their discount benchmark overrides.
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {Object.keys(editedBatchRows).length > 0 ? (
                                      <button
                                        type="button"
                                        title="Reset all edits to imported defaults"
                                        onClick={() => setEditedBatchRows({})}
                                        className="text-muted-foreground hover:text-foreground p-1 rounded cursor-pointer flex items-center gap-1 text-[11px] hover:bg-surface/60 transition-colors"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Reset edits</span>
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => setIsBatchPreviewOpen(false)}
                                      className="text-muted-foreground hover:text-foreground p-1 text-xs cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Preview Itemized Rows with Bulk Inline Editing */}
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-0.5">
                                  {batchPreviewItems.map((item) => (
                                    <div
                                      key={item.sourceKey}
                                      className={`p-2.5 rounded-lg border text-xs space-y-2 transition-all ${
                                        item.hasConflict
                                          ? 'border-warning/40 bg-warning/5 ring-1 ring-warning/20'
                                          : item.isAlreadyRemapped
                                          ? 'border-border/60 bg-surface/30 opacity-75'
                                          : 'border-border bg-surface/60'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: item.color }}
                                          />
                                          <span className="text-[11px] text-muted-foreground font-medium truncate">
                                            Imported Key: {item.sourceKey}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <Badge
                                            variant="outline"
                                            size="sm"
                                            className="font-mono text-[11px]"
                                          >
                                            {item.configuredBenchmark}% Override
                                          </Badge>
                                          {item.hasConflict ? (
                                            <Badge
                                              variant="danger"
                                              size="sm"
                                              className="text-[11px] font-normal"
                                            >
                                              Conflict: {item.conflictReason}
                                            </Badge>
                                          ) : item.isAlreadyRemapped ? (
                                            <Badge variant="muted" size="sm" className="text-[11px]">
                                              Remapped
                                            </Badge>
                                          ) : (
                                            <Badge
                                              variant="primary"
                                              size="sm"
                                              className="text-[11px]"
                                            >
                                              Will Create
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                        <div>
                                          <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                                            Category Name
                                          </label>
                                          <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) =>
                                              handleUpdateBatchRow(
                                                item.sourceKey,
                                                e.target.value,
                                                item.rawSlug,
                                                false
                                              )
                                            }
                                            placeholder="e.g. Media & Streaming"
                                            className="w-full h-7 px-2 text-xs font-medium rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                                            Slug (Normalized)
                                          </label>
                                          <input
                                            type="text"
                                            value={item.rawSlug}
                                            onChange={(e) =>
                                              handleUpdateBatchRow(
                                                item.sourceKey,
                                                item.name,
                                                e.target.value,
                                                true
                                              )
                                            }
                                            placeholder="e.g. media-streaming"
                                            className="w-full h-7 px-2 text-xs font-mono rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {batchPreviewItems.length > creatableBatchItems.length ? (
                                  <div className="p-2 rounded-lg bg-warning-subtle border border-warning/30 text-[11px] text-warning flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      {batchPreviewItems.length - creatableBatchItems.length} row(s) have conflicts or are already remapped. Only the {creatableBatchItems.length} valid row(s) will be created.
                                    </span>
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-lg bg-surface/60 border border-border/60 text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span>
                                      Imported colors & icons will be preserved. You can customize them anytime in Settings.
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsBatchPreviewOpen(false)}
                                    className="h-7 text-xs px-2.5"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    isLoading={isBatchCreating}
                                    disabled={creatableBatchItems.length === 0}
                                    onClick={handleExecuteBatchCreate}
                                    className="h-7 text-xs px-3 gap-1.5"
                                  >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                    <span>
                                      Create {creatableBatchItems.length} Valid Categor{creatableBatchItems.length === 1 ? 'y' : 'ies'} & Map
                                    </span>
                                  </Button>
                                </div>
                              </div>
                            ) : null}

                            {rep.unmatched.map((un) => {
                              const currentSelection = manualRemappings[un.sourceKey] || 'skip';
                              const suggestion = findCategorySuggestion(un.sourceName || un.sourceSlug || '', categories);
                              const isCustom = currentSelection !== 'skip';

                              return (
                                <div
                                  key={un.sourceKey}
                                  className={`p-2.5 rounded-lg border transition-all space-y-2 ${
                                    isCustom ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="font-semibold text-foreground text-[11px] truncate flex items-center gap-1.5">
                                        <span>{un.sourceName || un.sourceSlug || un.sourceKey}</span>
                                        {un.sourceSlug ? (
                                          <span className="font-mono text-muted-foreground font-normal text-[11px]">
                                            ({un.sourceSlug})
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        Category not present in current workspace
                                      </div>
                                    </div>
                                    <Badge
                                      variant={isCustom ? 'primary' : 'outline'}
                                      size="sm"
                                      className="font-mono text-[11px] shrink-0"
                                    >
                                      {un.configuredBenchmark}% {isCustom ? 'Remapped' : 'Skipped'}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center gap-2 pt-1.5 border-t border-border/50">
                                    <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                                      Map to:
                                    </span>
                                    <select
                                      value={currentSelection}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'skip') {
                                          const next = { ...manualRemappings };
                                          delete next[un.sourceKey];
                                          setManualRemappings(next);
                                        } else {
                                          setManualRemappings({
                                            ...manualRemappings,
                                            [un.sourceKey]: val,
                                          });
                                        }
                                      }}
                                      className="w-full h-7 px-2 text-[11px] rounded-md border border-border bg-surface text-foreground font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                      <option value="skip">
                                        Skip (Use global {globalBenchmark}% benchmark)
                                      </option>
                                      {suggestion ? (
                                        <option value={suggestion.category.id}>
                                          Suggested: {suggestion.category.name} ({Math.round(suggestion.similarity * 100)}% match)
                                        </option>
                                      ) : null}
                                      <optgroup label="Available Workspace Categories">
                                        {categories.map((c) => (
                                          <option key={c.id} value={c.id}>
                                            {c.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    </select>
                                  </div>

                                  {/* Inline Category Creation Section */}
                                  {creatingCategoryFor === un.sourceKey ? (
                                    <div className="p-3 rounded-lg border border-primary/40 bg-card space-y-2.5 mt-2 animate-in fade-in zoom-in-95 duration-150">
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground text-[11px] flex items-center gap-1.5">
                                          <Plus className="w-3.5 h-3.5 text-primary" />
                                          Create Category in Workspace
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setCreatingCategoryFor(null);
                                            setCreateCategoryError(null);
                                          }}
                                          className="text-muted-foreground hover:text-foreground text-[11px] cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                      </div>

                                      {createCategoryError ? (
                                        <div className="p-2 rounded bg-danger-subtle border border-danger/30 text-danger text-[11px] flex items-center gap-1.5">
                                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                          <span>{createCategoryError}</span>
                                        </div>
                                      ) : null}

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                                            Category Name
                                          </label>
                                          <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="e.g. Media & Streaming"
                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                                            Category Slug
                                          </label>
                                          <input
                                            type="text"
                                            value={newCategorySlug}
                                            onChange={(e) => setNewCategorySlug(e.target.value)}
                                            placeholder="e.g. media-streaming"
                                            className="w-full h-7 px-2 text-xs rounded border border-border bg-surface text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                                        <div className="text-[11px] text-muted-foreground">
                                          Will create category & map {un.configuredBenchmark}% benchmark override.
                                        </div>
                                        <Button
                                          type="button"
                                          variant="primary"
                                          size="sm"
                                          isLoading={isCreatingCategory}
                                          onClick={() => handleConfirmCreateCategory(un.sourceKey)}
                                          className="h-6 text-[11px] px-2.5 gap-1 shrink-0"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Create & Map
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="pt-0.5 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleStartCreateCategory(un)}
                                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer py-0.5"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Create &quot;{un.sourceName || un.sourceSlug || 'Category'}&quot; inline</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Restore Strategy Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[hsl(var(--foreground))] block">
                      Restore Strategy
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRestoreMode('merge')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          restoreMode === 'merge'
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] ring-1 ring-[hsl(var(--primary)/0.3)]'
                            : 'border-[hsl(var(--border))] bg-[hsl(var(--surface)/0.5)]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-[hsl(var(--foreground))]">
                          <Layers className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                          Merge & Append
                        </div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                          Adds imported items alongside your current {subscriptions.length} existing
                          records.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRestoreMode('replace')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          restoreMode === 'replace'
                            ? 'border-[hsl(var(--danger))] bg-[hsl(var(--danger-subtle))] ring-1 ring-[hsl(var(--danger)/0.3)]'
                            : 'border-[hsl(var(--border))] bg-[hsl(var(--surface)/0.5)]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-[hsl(var(--danger))]">
                          <Trash2 className="w-3.5 h-3.5 text-[hsl(var(--danger))]" />
                          Replace Workspace
                        </div>
                        <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                          Clears your current {subscriptions.length} records and restores fresh.
                        </div>
                      </button>
                    </div>
                  </div>

                  {restoreMode === 'replace' ? (
                    <div className="p-3 text-[11px] bg-[hsl(var(--danger-subtle))] border border-[hsl(var(--danger)/0.3)] text-[hsl(var(--danger))] rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        Warning: Replace mode will permanently overwrite current subscriptions.
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[hsl(var(--border))] flex items-center justify-between">
          {restoreResult ? (
            <div className="flex items-center justify-between w-full gap-2">
              {restoreResult.skippedCollisionCount + restoreResult.skippedUnmatchedCount > 0 ? (
                <a href="#category-benchmarks" onClick={handleNavigateToCategoryBenchmarks}>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
                    <span>Review Skipped Mappings</span>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              ) : (
                <div />
              )}

              <Button type="button" variant="primary" size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                Cancel
              </Button>

              {validation ? (
                <Button
                  type="button"
                  variant={restoreMode === 'replace' ? 'danger' : 'primary'}
                  size="sm"
                  isLoading={isRestoring}
                  onClick={handleExecuteRestore}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Confirm Restore ({validation.counts?.subscriptions} items)
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
