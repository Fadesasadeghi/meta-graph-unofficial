import { AccountStore } from '../accounts/account_store.js';
import type { AnalyticsReport } from './instagram_analytics_service.js';
export interface AnalyticsSnapshot {
    id: string;
    ownerId: string;
    accountId: string;
    source: 'mock' | 'live';
    capturedAt: string;
    report: AnalyticsReport;
}
export declare class AnalyticsSnapshotStore {
    private readonly accounts;
    private readonly directory;
    constructor(accounts: AccountStore, directory?: string);
    private accountDirectory;
    save(ownerId: string, report: AnalyticsReport): Promise<AnalyticsSnapshot>;
    list(ownerId: string, accountId: string): Promise<AnalyticsSnapshot[]>;
}
