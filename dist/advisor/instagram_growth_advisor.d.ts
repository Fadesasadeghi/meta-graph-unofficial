import type { AnalyticsReport } from '../analytics/instagram_analytics_service.js';
export type AdviceConfidence = 'low' | 'medium';
export interface GrowthExperiment {
    id: string;
    title: string;
    hypothesis: string;
    evidence: string[];
    action: string;
    successMetrics: string[];
    confidence: AdviceConfidence;
    limitations: string[];
}
export interface GrowthAdviceReport {
    accountId: string;
    username: string;
    source: 'mock' | 'live';
    generatedAt: string;
    experiments: GrowthExperiment[];
    warnings: string[];
}
export declare class InstagramGrowthAdvisor {
    generate(report: AnalyticsReport): GrowthAdviceReport;
}
