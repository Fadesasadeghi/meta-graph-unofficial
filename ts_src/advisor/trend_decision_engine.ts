import type {
  GrowthAdviceReport
} from './instagram_growth_advisor.js';

import type {
  AnalyticsTrendReport
} from '../analytics/analytics_trend_analyzer.js';

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

export class TrendDecisionEngine {
  evaluate(
    advice: GrowthAdviceReport,
    trend: AnalyticsTrendReport | null
  ): GrowthDecisionReport {
    if (trend && (
      advice.accountId !== trend.accountId ||
      advice.source !== trend.source
    )) {
      throw new Error(
        'Growth advice and analytics trend do not match.'
      );
    }

    const decisions: GrowthDecision[] = [];
    const warnings = [...advice.warnings];

    if (!trend) {
      warnings.push(
        'No historical trend available for comparison.'
      );
    } else {
      warnings.push(...trend.warnings);

      const engagement = trend.engagementRate;
      const followers = trend.followers;

      const incompleteHistory =
        trend.dataQuality.completeMediaHistory === false;

      const previousPosts = trend.dataQuality.previousCompletePosts;
      const currentPosts = trend.dataQuality.currentCompletePosts;

      const validPostCount = (value: unknown): value is number =>
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 5;

      const limitedEvidence =
        !validPostCount(previousPosts) ||
        !validPostCount(currentPosts);

      const intervalMs =
        Date.parse(trend.currentDate) -
        Date.parse(trend.previousDate);

      const shortInterval =
        !Number.isFinite(intervalMs) ||
        intervalMs < 24 * 60 * 60 * 1000;

      const weakEngagementEvidence =
        incompleteHistory || limitedEvidence || shortInterval;

      if (limitedEvidence) {
        warnings.push(
          'Fewer than five complete posts in at least one snapshot.'
        );
      }

      if (shortInterval) {
        warnings.push(
          'Snapshot comparison interval is shorter than 24 hours or invalid.'
        );
      }

      if (
        engagement &&
        engagement.absoluteChange <= -0.5
      ) {
        decisions.push({
          id: 'review-engagement-decline',
          priority: weakEngagementEvidence ? 'low' : 'high',
          title: 'Review declining engagement',
          reason:
            `Engagement decreased by ${
              Math.abs(engagement.absoluteChange)
            } percentage points.`,
          suggestedAction:
            'Review recent content performance and identify possible causes before making changes.',
          requiresApproval: true
        });
      }

      if (
        followers &&
        followers.percentageChange !== null &&
        followers.percentageChange <= -5
      ) {
        decisions.push({
          id: 'investigate-follower-decline',
          priority: 'high',
          title: 'Investigate follower decline',
          reason:
            `Follower count changed by ${
              followers.percentageChange
            }%.`,
          suggestedAction:
            'Review audience trends, recent content and account changes.',
          requiresApproval: true
        });
      }
    }

    for (const experiment of advice.experiments) {
      decisions.push({
        id: `experiment:${experiment.id}`,
        priority: 'medium',
        title: experiment.title,
        reason:
          experiment.evidence.join(' | ') ||
          experiment.hypothesis,
        suggestedAction: experiment.action,
        requiresApproval: true
      });
    }

    if (advice.source === 'mock') {
      warnings.push(
        'Decisions are based on simulated data.'
      );
    }

    const rank: Record<DecisionPriority, number> = {
      high: 0,
      medium: 1,
      low: 2
    };

    decisions.sort(
      (a, b) => rank[a.priority] - rank[b.priority]
    );

    return {
      accountId: advice.accountId,
      source: advice.source,
      decisions,
      warnings
    };
  }
}
