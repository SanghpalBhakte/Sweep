// =============================================================================
// Sift - Data Export & Backup Validation Tests
// Path: src/lib/utils/backup.test.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  generateFullBackupJson,
  validateBackupJson,
  generateBackupReadme,
  remapCategoryBenchmarkOverrides,
  findCategorySuggestion,
  resolveCategoryDefaultColor,
  DEFAULT_CATEGORY_PRESET_COLORS,
} from './backup';
import { Profile, Subscription, Category } from '../types';

describe('Backup & Export Manifest Engine', () => {
  const mockProfile: Profile = {
    id: 'user-1',
    email: 'alex@sift.studio',
    full_name: 'Alex Mercer',
    currency_preference: 'EUR',
    theme_preference: 'night-shelf',
    default_reminder_days: [7, 3, 1],
    annual_benchmark_percent: 20,
    category_annual_benchmarks: {
      'cat-dev': 10,
      'cat-media': 20,
    },
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockCategories: Category[] = [
    { user_id: null,
      id: 'cat-dev',
      name: 'Software & Dev',
      slug: 'dev',
      color: '#10b981',
      icon: 'code',
      created_at: '2025-01-01T00:00:00Z',
    },
  ];

  const mockSubscriptions: Subscription[] = [
    {
      id: 'sub-1',
      user_id: 'user-1',
      name: 'GitHub Copilot',
      amount: 10,
      currency: 'USD',
      billing_cycle: 'monthly',
      status: 'active',
      start_date: '2025-01-01',
      next_renewal_date: '2025-02-01',
      is_trial: false,
      reminder_offsets: [3],
      value_rating: 'essential',
      monthly_amount: 10,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ];

  it('includes active global and per-category benchmark configurations in the exported JSON manifest', () => {
    const backup = generateFullBackupJson({
      userEmail: 'alex@sift.studio',
      profile: mockProfile,
      subscriptions: mockSubscriptions,
      categories: mockCategories,
    });

    expect(backup.version).toBe('1.0');
    expect(backup.app).toBe('Sweep');
    expect(backup.profile.currency_preference).toBe('EUR');
    expect(backup.profile.theme_preference).toBe('night-shelf');
    expect(backup.profile.annual_benchmark_percent).toBe(20);
    expect(backup.profile.category_annual_benchmarks).toEqual({
      'cat-dev': 10,
      'cat-media': 20,
    });
    expect(backup.subscriptions).toHaveLength(1);
    expect(backup.categories).toHaveLength(1);
  });

  it('captures category_slug snapshot on exported subscriptions by resolving category_id against categories', () => {
    const subsWithCategory: Subscription[] = [
      {
        ...mockSubscriptions[0],
        category_id: 'cat-dev',
      },
      {
        ...mockSubscriptions[0],
        id: 'sub-2',
        name: 'Uncategorized Service',
        category_id: null,
      },
    ];

    const backup = generateFullBackupJson({
      userEmail: 'alex@sift.studio',
      profile: mockProfile,
      subscriptions: subsWithCategory,
      categories: mockCategories,
    });

    expect(backup.subscriptions[0].category_slug).toBe('dev');
    expect(backup.subscriptions[1].category_slug).toBeUndefined();
  });

  it('validates JSON backups containing benchmark configuration correctly', () => {
    const backup = generateFullBackupJson({
      userEmail: 'alex@sift.studio',
      profile: mockProfile,
      subscriptions: mockSubscriptions,
      categories: mockCategories,
    });

    const jsonString = JSON.stringify(backup);
    const result = validateBackupJson(jsonString);

    expect(result.valid).toBe(true);
    expect(result.data?.profile.annual_benchmark_percent).toBe(20);
    expect(result.data?.profile.category_annual_benchmarks).toEqual({
      'cat-dev': 10,
      'cat-media': 20,
    });
    expect(result.counts?.subscriptions).toBe(1);
  });

  it('preserves backward compatibility with legacy backups lacking benchmark settings', () => {
    const legacyBackup = {
      version: '1.0',
      app: 'Sift',
      exported_at: '2024-06-01T00:00:00Z',
      user_email: 'legacy@sift.studio',
      profile: {
        currency_preference: 'USD',
        theme_preference: 'paper-ledger',
        default_reminder_days: [7, 3, 1],
      },
      subscriptions: [
        {
          name: 'Legacy SaaS',
          amount: 15,
          currency: 'USD',
          billing_cycle: 'monthly',
          status: 'active',
          start_date: '2024-01-01',
          next_renewal_date: '2024-07-01',
          is_trial: false,
          value_rating: 'useful',
          monthly_amount: 15,
        },
      ],
      categories: [],
      payment_methods: [],
    };

    const result = validateBackupJson(JSON.stringify(legacyBackup));
    expect(result.valid).toBe(true);
    expect(result.data?.profile.annual_benchmark_percent).toBeUndefined();
    expect(result.counts?.subscriptions).toBe(1);
  });

  it('includes human-readable benchmark details in the backup README manifest', () => {
    const backup = generateFullBackupJson({
      userEmail: 'alex@sift.studio',
      profile: mockProfile,
      subscriptions: mockSubscriptions,
      categories: mockCategories,
    });

    const readme = generateBackupReadme(backup);
    expect(readme).toContain('Annual Discount Benchmark: 20% (2 category override(s))');
    expect(readme).toContain('SWEEP DATA BACKUP MANIFEST');
  });

  describe('remapCategoryBenchmarkOverrides (Portability & Slug Fallback)', () => {
    const sourceBackupCategories: Category[] = [
      { user_id: null, id: 'src-uuid-1', name: 'Software & Dev', slug: 'software-dev', color: '#10b981', icon: 'code', created_at: '' },
      { user_id: null, id: 'src-uuid-2', name: 'Media & Streaming', slug: 'media-streaming', color: '#6366f1', icon: 'tv', created_at: '' },
      { user_id: null, id: 'src-uuid-3', name: 'Productivity', slug: 'productivity', color: '#f59e0b', icon: 'briefcase', created_at: '' },
    ];

    it('matches by exact category UUID when restoring on the same instance', () => {
      const activeCategories: Category[] = [
        { user_id: null, id: 'src-uuid-1', name: 'Software & Dev', slug: 'software-dev', color: '#10b981', icon: 'code', created_at: '' },
        { user_id: null, id: 'src-uuid-2', name: 'Media & Streaming', slug: 'media-streaming', color: '#6366f1', icon: 'tv', created_at: '' },
      ];

      const backupBenchmarks = {
        'src-uuid-1': 10,
        'src-uuid-2': 20,
      };

      const report = remapCategoryBenchmarkOverrides(backupBenchmarks, sourceBackupCategories, activeCategories);

      expect(report.matchedByUuid).toBe(2);
      expect(report.matchedBySlug).toBe(0);
      expect(report.skippedAmbiguous).toBe(0);
      expect(report.skippedMissing).toBe(0);
      expect(report.remappedBenchmarks).toEqual({
        'src-uuid-1': 10,
        'src-uuid-2': 20,
      });
    });

    it('falls back to matching by slug when restoring on a fresh instance with different category UUIDs', () => {
      const destFreshCategories: Category[] = [
        { user_id: null, id: 'dest-new-uuid-1', name: 'Software & Dev', slug: 'software-dev', color: '#10b981', icon: 'code', created_at: '' },
        { user_id: null, id: 'dest-new-uuid-2', name: 'Media & Streaming', slug: 'media-streaming', color: '#6366f1', icon: 'tv', created_at: '' },
      ];

      const backupBenchmarks = {
        'src-uuid-1': 10,
        'src-uuid-2': 20,
      };

      const report = remapCategoryBenchmarkOverrides(backupBenchmarks, sourceBackupCategories, destFreshCategories);

      expect(report.matchedByUuid).toBe(0);
      expect(report.matchedBySlug).toBe(2);
      expect(report.skippedAmbiguous).toBe(0);
      expect(report.skippedMissing).toBe(0);
      expect(report.remappedBenchmarks).toEqual({
        'dest-new-uuid-1': 10,
        'dest-new-uuid-2': 20,
      });
    });

    it('safely skips ambiguous slug collisions without guessing when duplicate destination slugs exist', () => {
      const destCategoriesWithDuplicateSlugs: Category[] = [
        { user_id: null, id: 'dup-1', name: 'Dev 1', slug: 'software-dev', color: '#10b981', icon: 'code', created_at: '' },
        { user_id: null, id: 'dup-2', name: 'Dev 2', slug: 'software-dev', color: '#10b981', icon: 'code', created_at: '' },
        { user_id: null, id: 'unique-1', name: 'Media', slug: 'media-streaming', color: '#6366f1', icon: 'tv', created_at: '' },
      ];

      const backupBenchmarks = {
        'src-uuid-1': 10, // Slug: software-dev (ambiguous in destination)
        'src-uuid-2': 20, // Slug: media-streaming (unique)
      };

      const report = remapCategoryBenchmarkOverrides(
        backupBenchmarks,
        sourceBackupCategories,
        destCategoriesWithDuplicateSlugs
      );

      expect(report.matchedBySlug).toBe(1);
      expect(report.skippedAmbiguous).toBe(1);
      expect(report.collisions).toHaveLength(1);
      expect(report.collisions[0].sourceSlug).toBe('software-dev');
      expect(report.collisions[0].sourceName).toBe('Software & Dev');
      expect(report.collisions[0].configuredBenchmark).toBe(10);
      expect(report.collisions[0].conflictingCategories).toHaveLength(2);
      expect(report.remappedBenchmarks).toEqual({
        'unique-1': 20,
      });
    });

    it('safely skips categories that are missing in the destination workspace', () => {
      const destCategories: Category[] = [
        { user_id: null, id: 'dest-1', name: 'Software & Dev', slug: 'software-dev', color: '#10b981', icon: 'code', created_at: '' },
      ];

      const backupBenchmarks = {
        'src-uuid-1': 10, // Found
        'src-uuid-3': 15, // Productivity (missing in destination)
      };

      const report = remapCategoryBenchmarkOverrides(backupBenchmarks, sourceBackupCategories, destCategories);

      expect(report.matchedBySlug).toBe(1);
      expect(report.skippedMissing).toBe(1);
      expect(report.unmatched).toHaveLength(1);
      expect(report.unmatched[0].sourceName).toBe('Productivity');
      expect(report.unmatched[0].configuredBenchmark).toBe(15);
      expect(report.remappedBenchmarks).toEqual({
        'dest-1': 10,
      });
    });

    it('matches renamed categories using historical slug_aliases when UUID and current slug differ', () => {
      const destCategoriesWithAliases: Category[] = [
        { user_id: null,
          id: 'dest-renamed-1',
          name: 'Developer Tools & Cloud',
          slug: 'dev-tools-cloud', // renamed from 'software-dev'
          slug_aliases: ['software-dev', 'coding-tools'],
          color: '#10b981',
          icon: 'terminal',
          created_at: '',
        },
      ];

      const backupBenchmarks = {
        'src-uuid-1': 12, // Slug: software-dev
      };

      const report = remapCategoryBenchmarkOverrides(
        backupBenchmarks,
        sourceBackupCategories,
        destCategoriesWithAliases
      );

      expect(report.matchedByUuid).toBe(0);
      expect(report.matchedBySlug).toBe(1);
      expect(report.matchedByAlias).toBe(1);
      expect(report.skippedAmbiguous).toBe(0);
      expect(report.remappedBenchmarks).toEqual({
        'dest-renamed-1': 12,
      });
    });

    it('safely skips without guessing if historical slug aliases collide across multiple categories', () => {
      const destCategoriesWithConflictingAliases: Category[] = [
        { user_id: null,
          id: 'cat-a',
          name: 'Cloud Services',
          slug: 'cloud-services',
          slug_aliases: ['software-dev'],
          color: '#10b981',
          icon: 'server',
          created_at: '',
        },
        { user_id: null,
          id: 'cat-b',
          name: 'Developer Tools',
          slug: 'developer-tools',
          slug_aliases: ['software-dev'],
          color: '#3b82f6',
          icon: 'terminal',
          created_at: '',
        },
      ];

      const backupBenchmarks = {
        'src-uuid-1': 10, // Slug: software-dev (matches aliases of both cat-a and cat-b)
      };

      const report = remapCategoryBenchmarkOverrides(
        backupBenchmarks,
        sourceBackupCategories,
        destCategoriesWithConflictingAliases
      );

      expect(report.matchedBySlug).toBe(0);
      expect(report.skippedAmbiguous).toBe(1);
      expect(report.collisions).toHaveLength(1);
      expect(report.collisions[0].sourceSlug).toBe('software-dev');
      expect(report.collisions[0].conflictingCategories).toHaveLength(2);
      expect(report.remappedBenchmarks).toEqual({});
    });
  });

  describe('Advisory Category Similarity Suggestions', () => {
    const workspaceCategories: Category[] = [
      { user_id: null, id: 'cat-media', name: 'Media & Streaming', slug: 'media-streaming', color: '#6366f1', icon: 'tv', created_at: '' },
      { user_id: null, id: 'cat-dev', name: 'Software & Dev', slug: 'software-dev', color: '#10b981', icon: 'code', created_at: '' },
      { user_id: null, id: 'cat-ops', name: 'Infrastructure', slug: 'infra', color: '#f59e0b', icon: 'server', created_at: '' },
    ];

    it('suggests closest match for similar category names like Streaming Services -> Media & Streaming', () => {
      const suggestion = findCategorySuggestion('Streaming Services', workspaceCategories);
      expect(suggestion).not.toBeNull();
      expect(suggestion?.category.id).toBe('cat-media');
      expect(suggestion?.similarity).toBeGreaterThan(0.5);
    });

    it('suggests Developer Tools -> Software & Dev based on partial keyword overlap', () => {
      const suggestion = findCategorySuggestion('Software Development', workspaceCategories);
      expect(suggestion).not.toBeNull();
      expect(suggestion?.category.id).toBe('cat-dev');
    });

    it('returns null when category name has no plausible similarity rather than giving misleading suggestion', () => {
      const suggestion = findCategorySuggestion('Health & Medical', workspaceCategories);
      expect(suggestion).toBeNull();
    });
  });

  describe('Category Preset Color Rules', () => {
    it('preserves valid imported colors without alteration', () => {
      expect(resolveCategoryDefaultColor('#ff0055', 'Design Tools')).toBe('#ff0055');
      expect(resolveCategoryDefaultColor('terracotta', 'Media')).toBe('terracotta');
      expect(resolveCategoryDefaultColor('  #10b981  ', 'Dev')).toBe('#10b981');
    });

    it('assigns deterministic preset colors from palette when imported color is missing or empty', () => {
      const color1 = resolveCategoryDefaultColor(null, 'Developer Tools');
      const color2 = resolveCategoryDefaultColor('', 'Developer Tools');
      const color3 = resolveCategoryDefaultColor(undefined, 'Developer Tools');

      expect(color1).toBe(color2);
      expect(color2).toBe(color3);
      expect(DEFAULT_CATEGORY_PRESET_COLORS).toContain(color1);
    });

    it('distributes colors evenly across the preset palette using index offset during batch creation', () => {
      const colors = Array.from({ length: DEFAULT_CATEGORY_PRESET_COLORS.length }, (_, i) =>
        resolveCategoryDefaultColor(null, `Category ${i}`, i)
      );

      expect(colors).toEqual([...DEFAULT_CATEGORY_PRESET_COLORS]);
    });

    it('falls back to the primary theme preset (#527243) when both color and name are omitted', () => {
      expect(resolveCategoryDefaultColor(null, null)).toBe('#527243');
      expect(resolveCategoryDefaultColor('', '')).toBe('#527243');
    });
  });
});
