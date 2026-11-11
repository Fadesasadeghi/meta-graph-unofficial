import type { ProviderResult } from '../providers/instagram_provider.js';
import { AnalyticsHistoryService, type AnalyticsHistoryResult } from '../analytics/analytics_history_service.js';
import { InstagramGrowthAdvisor, type GrowthAdviceReport } from './instagram_growth_advisor.js';
import { TrendDecisionEngine, type GrowthDecisionReport } from './trend_decision_engine.js';
export interface OnDemandGrowthResult {
    analytics: AnalyticsHistoryResult;
    advice: GrowthAdviceReport;
    decisions: GrowthDecisionReport;
}
export declare class OnDemandGrowthService {
    private readonly history;
    private readonly growth;
    private readonly engine;
    constructor(history: AnalyticsHistoryService, growth?: InstagramGrowthAdvisor, engine?: TrendDecisionEngine);
    analyze(ownerId: string, accountId: string): Promise<ProviderResult<OnDemandGrowthResult>>;
}
