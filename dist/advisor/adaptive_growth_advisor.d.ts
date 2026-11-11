import type { GrowthAdviceReport, GrowthExperiment } from './instagram_growth_advisor.js';
import type { GrowthExperimentRecord } from '../experiments/types.js';
export interface AdaptiveExperimentAdvice {
    experiment: GrowthExperiment;
    completedTrials: number;
    improvedTrials: number;
    declinedTrials: number;
    unchangedTrials: number;
    priority: 'promising' | 'needs_testing' | 'reconsider';
    reasoning: string[];
}
export interface AdaptiveGrowthAdviceReport {
    accountId: string;
    source: 'mock' | 'live';
    generatedAt: string;
    recommendations: AdaptiveExperimentAdvice[];
    warnings: string[];
}
export declare class AdaptiveGrowthAdvisor {
    adapt(advice: GrowthAdviceReport, history: GrowthExperimentRecord[]): AdaptiveGrowthAdviceReport;
}
