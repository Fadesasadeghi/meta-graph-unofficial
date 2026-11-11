import type { GrowthAdviceReport } from './instagram_growth_advisor.js';
import type { AnalyticsTrendReport } from '../analytics/analytics_trend_analyzer.js';
export type DecisionPriority = 'high' | 'medium' | 'low';
export interface GrowthDecision {
    id: string;
    priority: DecisionPriority;
    title: string;
    reason: string;
    suggestedAction: string;
    requiresApproval: true;
}
export interface GrowthDecisionReport {
    accountId: string;
    source: 'mock' | 'live';
    decisions: GrowthDecision[];
    warnings: string[];
}
export declare class TrendDecisionEngine {
    evaluate(advice: GrowthAdviceReport, trend: AnalyticsTrendReport | null): GrowthDecisionReport;
}
