import { type AdaptiveGrowthAdviceReport } from './adaptive_growth_advisor.js';
import type { GrowthAdviceReport } from './instagram_growth_advisor.js';
import type { GrowthExperimentRecord } from '../experiments/types.js';
export interface AccountAdaptiveAdviceReport extends AdaptiveGrowthAdviceReport {
    templateAccountId: string;
    templateSource: 'mock';
    basedOnDemoTemplate: true;
}
export declare function adaptGrowthAdviceForAccount(template: GrowthAdviceReport, targetAccountId: string, history: GrowthExperimentRecord[]): AccountAdaptiveAdviceReport;
