import type { AnalyticsSnapshot } from './analytics_snapshot_store.js';

export interface MetricChange {
  previous: number;
  current: number;
  absoluteChange: number;
  percentageChange: number | null;
  direction: 'up' | 'down' | 'unchanged';
}

export interface AnalyticsTrendReport {
  accountId: string;
  source: 'mock' | 'live';
  previousSnapshotId: string;
  currentSnapshotId: string;
  previousDate: string;
  currentDate: string;
  followers: MetricChange | null;
  engagementRate: MetricChange | null;
  dataQuality: {
    completeMediaHistory: boolean;
    previousCompletePosts: number;
    currentCompletePosts: number;
  };
  warnings: string[];
}

export class AnalyticsTrendAnalyzer {
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private compare(
    previous: number | null,
    current: number | null
  ): MetricChange | null {
    if (
      previous === null ||
      current === null ||
      !Number.isFinite(previous) ||
      !Number.isFinite(current)
    ) {
      return null;
    }

    const difference = current - previous;

    return {
      previous,
      current,
      absoluteChange: this.round(difference),
      percentageChange: previous === 0
        ? null
        : this.round((difference / previous) * 100),
      direction: difference > 0
        ? 'up'
        : difference < 0
          ? 'down'
          : 'unchanged'
    };
  }

  analyze(
    previous: AnalyticsSnapshot,
    current: AnalyticsSnapshot
  ): AnalyticsTrendReport {
    if (
      previous.ownerId !== current.ownerId ||
      previous.accountId !== current.accountId
    ) {
      throw new Error('Cannot compare different accounts.');
    }

    if (previous.source !== current.source) {
      throw new Error('Cannot mix mock and live analytics.');
    }

    const previousTime = Date.parse(previous.capturedAt);
    const currentTime = Date.parse(current.capturedAt);

    if (
      !Number.isFinite(previousTime) ||
      !Number.isFinite(currentTime) ||
      previousTime >= currentTime
    ) {
      throw new Error('Snapshots must be chronologically ordered.');
    }

    const followers = this.compare(
      previous.report.followersCount,
      current.report.followersCount
    );

    const engagementRate = this.compare(
      previous.report.averageEngagementRatePct,
      current.report.averageEngagementRatePct
    );

    const warnings: string[] = [];

    if (current.source === 'mock') {
      warnings.push(
        'Trends are based on simulated data, not live Instagram performance.'
      );
    }

    if (!followers) {
      warnings.push('Follower trend unavailable.');
    }

    if (!engagementRate) {
      warnings.push('Engagement trend unavailable.');
    }

    const completeMediaHistory =
      previous.report.dataQuality.completeMediaHistory &&
      current.report.dataQuality.completeMediaHistory;

    if (!completeMediaHistory) {
      warnings.push(
        'Incomplete media history may affect comparisons.'
      );
    }

    return {
      accountId: current.accountId,
      source: current.source,
      previousSnapshotId: previous.id,
      currentSnapshotId: current.id,
      previousDate: previous.capturedAt,
      currentDate: current.capturedAt,
      followers,
      engagementRate,
      dataQuality: {
        completeMediaHistory,
        previousCompletePosts:
          previous.report.dataQuality.postsWithCompleteEngagement,
        currentCompletePosts:
          current.report.dataQuality.postsWithCompleteEngagement
      },
      warnings
    };
  }
}
