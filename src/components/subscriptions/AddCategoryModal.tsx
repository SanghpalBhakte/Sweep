'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { Category } from '@/lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { X, FolderPlus, Plus } from 'lucide-react';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (cat: Category) => void;
}

const CATEGORY_COLORS = [
  { label: 'Moss (Green)', value: 'moss' },
  { label: 'Slate (Blue)', value: 'slate' },
  { label: 'Ochre (Gold)', value: 'ochre' },
  { label: 'Terracotta (Rust)', value: 'terracotta' },
  { label: 'Sage (Soft Green)', value: 'sage' },
  { label: 'Stone (Neutral)', value: 'stone' },
  { label: 'Indigo (Deep Blue)', value: 'indigo' },
  { label: 'Emerald (Vibrant Green)', value: 'emerald' },
  { label: 'Amber (Orange)', value: 'amber' },
  { label: 'Rose (Pink)', value: 'rose' },
  { label: 'Violet (Purple)', value: 'violet' },
  { label: 'Teal (Cyan)', value: 'teal' },
];

export function AddCategoryModal({
  isOpen,
  onClose,
  onCreated,
}: AddCategoryModalProps) {
  const { addCategory } = useSubscriptions();

  const [name, setName] = useState('');
  const [color, setColor] = useState('moss');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setColor('moss');
      setError(null);

      const timer = setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a category name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await addCategory({
        name: name.trim(),
        color,
        icon: 'folder',
      });

      onCreated?.(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-180"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-cat-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-card border border-border rounded-modal shadow-popover overflow-hidden flex flex-col animate-in zoom-in-[0.985] fade-in duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <FolderPlus className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="add-cat-title" className="text-sm font-semibold text-foreground">
                Add Category
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Organize your recurring subscriptions into custom groups
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="max-md:min-h-[44px] max-md:min-w-[44px] max-md:-mr-2 inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 sm:px-5 py-4 space-y-3.5">
          {error ? (
            <div className="px-3 py-2 text-xs bg-danger-subtle border border-danger/25 text-danger rounded-lg leading-relaxed">
              {error}
            </div>
          ) : null}

          <Input
            ref={inputRef}
            label="Category Name *"
            placeholder="e.g. AI & Copilots, Gym & Fitness, Hosting"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Select
            label="Color Theme"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            {CATEGORY_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="gap-1.5 shadow-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Save Category
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
