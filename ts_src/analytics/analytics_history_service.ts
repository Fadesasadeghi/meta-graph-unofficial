import type { ProviderResult } from '../providers/instagram_provider.js';
import {
  InstagramAnalyticsService,
  type AnalyticsReport
} from './instagram_analytics_service.js';
import {
  AnalyticsSnapshotStore,
  type AnalyticsSnapshot
} from './analytics_snapshot_store.js';
import {
  AnalyticsTrendAnalyzer,
  type AnalyticsTrendReport
} from './analytics_trend_analyzer.js';

export interface AnalyticsHistoryResult {
  report: AnalyticsReport;
  snapshot: AnalyticsSnapshot;
  trend: AnalyticsTrendReport | null;
  warnings: string[];
}

export class AnalyticsHistoryService {
  constructor(
    private readonly analytics: InstagramAnalyticsService,
    private readonly snapshots: AnalyticsSnapshotStore,
    private readonly trends = new AnalyticsTrendAnalyzer()
  ) {}

  private readonly pending = new Map<string, Promise<void>>();

  async analyzeAndRecord(
    ownerId: string,
    accountId: string
  ): Promise<ProviderResult<AnalyticsHistoryResult>> {
    const key = JSON.stringify([ownerId, accountId]);
    const previous = this.pending.get(key) ?? Promise.resolve();

    let release!: () => void;
    const turn = new Promise<void>(resolve => {
      release = resolve;
    });

    const tail = previous.then(() => turn);
    this.pending.set(key, tail);

    await previous;

    try {
      return await this.analyzeAndRecordUnlocked(ownerId, accountId);
    } finally {
      release();

      if (this.pending.get(key) === tail) {
        this.pending.delete(key);
      }
    }
  }

  private async analyzeAndRecordUnlocked(
    ownerId: string,
    accountId: string
  ): Promise<ProviderResult<AnalyticsHistoryResult>> {
    // Verify ownership before asking the provider for account data.
    const history = await this.snapshots.list(ownerId, accountId);

    const result = await this.analytics.analyzeAccount(accountId);

    if (!result.ok) {
      return result;
    }

    if (result.data.accountId !== accountId) {
      throw new Error('Analytics account identity mismatch.');
    }

    if (result.data.source !== result.source) {
      throw new Error('Analytics source identity mismatch.');
    }

    const previous = history
      .filter(snapshot => snapshot.source === result.source)
      .sort((a, b) =>
        b.capturedAt.localeCompare(a.capturedAt)
      )[0];

    const current = await this.snapshots.save(
      ownerId,
      result.data
    );

    const warnings: string[] = [];
    let trend: AnalyticsTrendReport | null = null;

    if (!previous) {
      warnings.push(
        'No previous snapshot exists for this data source.'
      );
    } else if (
      Date.parse(previous.capturedAt) <
      Date.parse(current.capturedAt)
    ) {
      trend = this.trends.analyze(previous, current);
      warnings.push(...trend.warnings);
    } else {
      warnings.push(
        'Snapshots are too close in time for chronological comparison.'
      );
    }

    return {
      ok: true,
      source: result.source,
      fetchedAt: result.fetchedAt,
      data: {
        report: result.data,
        snapshot: current,
        trend,
        warnings
      }
    };
  }
}
