import type { ProviderResult } from '../providers/instagram_provider.js';
import { InstagramAnalyticsService, type AnalyticsReport } from './instagram_analytics_service.js';
import { AnalyticsSnapshotStore, type AnalyticsSnapshot } from './analytics_snapshot_store.js';
import { AnalyticsTrendAnalyzer, type AnalyticsTrendReport } from './analytics_trend_analyzer.js';
export interface AnalyticsHistoryResult {
    report: AnalyticsReport;
    snapshot: AnalyticsSnapshot;
    trend: AnalyticsTrendReport | null;
    warnings: string[];
}
export declare class AnalyticsHistoryService {
    private readonly analytics;
    private readonly snapshots;
    private readonly trends;
    constructor(analytics: InstagramAnalyticsService, snapshots: AnalyticsSnapshotStore, trends?: AnalyticsTrendAnalyzer);
    private readonly pending;
    analyzeAndRecord(ownerId: string, accountId: string): Promise<ProviderResult<AnalyticsHistoryResult>>;
    private analyzeAndRecordUnlocked;
}
