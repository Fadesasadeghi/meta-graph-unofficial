import type { DraftType, CreateDraftInput } from '../content/draft_store.js';
import type { GrowthAdviceReport } from './instagram_growth_advisor.js';
export interface PreparedGrowthDraft {
    sourceAccountId: string;
    source: 'mock' | 'live';
    experimentId: string;
    experimentTitle: string;
    draft: CreateDraftInput;
    guidance: {
        hypothesis: string;
        action: string;
        successMetrics: string[];
        limitations: string[];
    };
    requiresApproval: true;
    saved: false;
}
export declare class GrowthDraftPreparer {
    prepare(report: GrowthAdviceReport, experimentId: string, type: DraftType): PreparedGrowthDraft;
}
