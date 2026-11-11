import {
  AdaptiveGrowthAdvisor,
  type AdaptiveGrowthAdviceReport
} from './adaptive_growth_advisor.js';

import type {
  GrowthAdviceReport
} from './instagram_growth_advisor.js';

import type {
  GrowthExperimentRecord
} from '../experiments/types.js';

export interface AccountAdaptiveAdviceReport
  extends AdaptiveGrowthAdviceReport {
  templateAccountId: string;
  templateSource: 'mock';
  basedOnDemoTemplate: true;
}

export function adaptGrowthAdviceForAccount(
  template: GrowthAdviceReport,
  targetAccountId: string,
  history: GrowthExperimentRecord[]
): AccountAdaptiveAdviceReport {
  if (template.source !== 'mock') {
    throw new Error(
      'This adapter only supports explicitly labeled mock templates.'
    );
  }

  if (
    typeof targetAccountId !== 'string' ||
    !targetAccountId.trim()
  ) {
    throw new Error('Valid target account ID is required.');
  }

  const scopedHistory = history.filter(
    record => record.accountId === targetAccountId
  );

  const scopedTemplate: GrowthAdviceReport = {
    ...template,
    accountId: targetAccountId
  };

  const adapted = new AdaptiveGrowthAdvisor().adapt(
    scopedTemplate,
    scopedHistory
  );

  return {
    ...adapted,
    templateAccountId: template.accountId,
    templateSource: 'mock',
    basedOnDemoTemplate: true,
    warnings: [
      ...adapted.warnings,
      'Recommendations originate from a demo template, not from analytics of the selected account.',
      'Historical results are considered only for the selected account.'
    ]
  };
}
