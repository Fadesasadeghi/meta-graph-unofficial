import type { ProviderResult } from '../providers/instagram_provider.js';

import {
  AnalyticsHistoryService,
  type AnalyticsHistoryResult
} from '../analytics/analytics_history_service.js';

import {
  InstagramGrowthAdvisor,
  type GrowthAdviceReport
} from './instagram_growth_advisor.js';

import {
  TrendDecisionEngine,
  type GrowthDecisionReport
} from './trend_decision_engine.js';

export interface OnDemandGrowthResult {
  analytics: AnalyticsHistoryResult;
  advice: GrowthAdviceReport;
  decisions: GrowthDecisionReport;
}

export class OnDemandGrowthService {
  constructor(
    private readonly history: AnalyticsHistoryService,
    private readonly growth = new InstagramGrowthAdvisor(),
    private readonly engine = new TrendDecisionEngine()
  ) {}

  async analyze(
    ownerId: string,
    accountId: string
  ): Promise<ProviderResult<OnDemandGrowthResult>> {
    const result = await this.history.analyzeAndRecord(
      ownerId,
      accountId
    );

    if (!result.ok) {
      return result;
    }

    if (
      result.data.report.accountId !== accountId ||
      result.data.report.source !== result.source
    ) {
      throw new Error('On-demand analytics identity mismatch.');
    }

    const advice = this.growth.generate(result.data.report);
    const decisions = this.engine.evaluate(
      advice,
      result.data.trend
    );

    return {
      ok: true,
      source: result.source,
      fetchedAt: result.fetchedAt,
      data: {
        analytics: result.data,
        advice,
        decisions
      }
    };
  }
}
