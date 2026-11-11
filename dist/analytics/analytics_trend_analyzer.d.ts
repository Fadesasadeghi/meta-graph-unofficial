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
export declare class AnalyticsTrendAnalyzer {
    private round;
    private compare;
    analyze(previous: AnalyticsSnapshot, current: AnalyticsSnapshot): AnalyticsTrendReport;
}
