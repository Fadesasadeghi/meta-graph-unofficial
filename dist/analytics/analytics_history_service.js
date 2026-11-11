import { AnalyticsTrendAnalyzer } from './analytics_trend_analyzer.js';
export class AnalyticsHistoryService {
    analytics;
    snapshots;
    trends;
    constructor(analytics, snapshots, trends = new AnalyticsTrendAnalyzer()) {
        this.analytics = analytics;
        this.snapshots = snapshots;
        this.trends = trends;
    }
    pending = new Map();
    async analyzeAndRecord(ownerId, accountId) {
        const key = JSON.stringify([ownerId, accountId]);
        const previous = this.pending.get(key) ?? Promise.resolve();
        let release;
        const turn = new Promise(resolve => {
            release = resolve;
        });
        const tail = previous.then(() => turn);
        this.pending.set(key, tail);
        await previous;
        try {
            return await this.analyzeAndRecordUnlocked(ownerId, accountId);
        }
        finally {
            release();
            if (this.pending.get(key) === tail) {
                this.pending.delete(key);
            }
        }
    }
    async analyzeAndRecordUnlocked(ownerId, accountId) {
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
            .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
        const current = await this.snapshots.save(ownerId, result.data);
        const warnings = [];
        let trend = null;
        if (!previous) {
            warnings.push('No previous snapshot exists for this data source.');
        }
        else if (Date.parse(previous.capturedAt) <
            Date.parse(current.capturedAt)) {
            trend = this.trends.analyze(previous, current);
            warnings.push(...trend.warnings);
        }
        else {
            warnings.push('Snapshots are too close in time for chronological comparison.');
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
