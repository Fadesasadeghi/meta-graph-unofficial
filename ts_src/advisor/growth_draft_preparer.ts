import type { DraftType, CreateDraftInput } from '../content/draft_store.js';
import type { GrowthAdviceReport, GrowthExperiment } from './instagram_growth_advisor.js';

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

export class GrowthDraftPreparer {
  prepare(
    report: GrowthAdviceReport,
    experimentId: string,
    type: DraftType
  ): PreparedGrowthDraft {
    if (!['post', 'story', 'reel'].includes(type)) {
      throw new Error('Invalid draft type.');
    }

    const experiment: GrowthExperiment | undefined =
      report.experiments.find(item => item.id === experimentId);

    if (!experiment) {
      throw new Error('Experiment not found in the advice report.');
    }

    if (!report.accountId || !report.username) {
      throw new Error('A valid advice report is required.');
    }

    const caption = [
      '[Draft — review before posting]',
      '',
      'موضوع محتوا: ' + experiment.title,
      '',
      'ایده اصلی:',
      experiment.action,
      '',
      'متن نهایی کپشن را متناسب با محتوای واقعی خودتان بنویسید.',
      '',
      '[Caption requires editing]'
    ].join('\n');

    if (caption.length > 2200) {
      throw new Error('Generated caption exceeds draft limit.');
    }

    return {
      sourceAccountId: report.accountId,
      source: report.source,
      experimentId,
      experimentTitle: experiment.title,
      draft: {
        type,
        caption,
        hashtags: []
      },
      guidance: {
        hypothesis: experiment.hypothesis,
        action: experiment.action,
        successMetrics: [...experiment.successMetrics],
        limitations: [...experiment.limitations]
      },
      requiresApproval: true,
      saved: false
    };
  }
}
