import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  OnDemandGrowthService
} from '../dist/advisor/on_demand_growth_service.js';

const accountId = 'demo-account';

function makeReport() {
  return {
    accountId,
    username: 'demo.account',
    source: 'mock',
    analyzedAt: '2026-11-11T10:00:00Z',
    followersCount: 900,
    analyzedPostCount: 1,
    averageEngagementRatePct: 4.2,
    engagementRateDenominator: 'followers',
    contentMix: {
      image: 1,
      video: 0,
      carousel: 0,
      reel: 0
    },
    rankedPosts: [{
      id: 'post-1',
      type: 'image',
      publishedAt: '2026-11-10T10:00:00Z',
      likes: 30,
      comments: 8,
      engagementRatePct: 4.2
    }],
    dataQuality: {
      postsWithCompleteEngagement: 1,
      postsWithMissingEngagement: 0,
      completeMediaHistory: true,
      previousCompletePosts: 20,
      currentCompletePosts: 20
    },
    recommendations: []
  };
}

test('produces on-demand growth recommendations', async () => {
  let calls = 0;

  const history = {
    async analyzeAndRecord(ownerId, requestedAccountId) {
      calls++;
      assert.equal(ownerId, 'owner-a');
      assert.equal(requestedAccountId, accountId);

      const report = makeReport();

      return {
        ok: true,
        source: 'mock',
        fetchedAt: report.analyzedAt,
        data: {
          report,
          snapshot: {
            id: 'snapshot-new',
            ownerId,
            accountId,
            source: 'mock',
            capturedAt: report.analyzedAt,
            report
          },
          trend: {
            accountId,
            source: 'mock',
            previousSnapshotId: 'snapshot-old',
            currentSnapshotId: 'snapshot-new',
            previousDate: '2026-11-01T10:00:00Z',
            currentDate: report.analyzedAt,
            followers: {
              previous: 1000,
              current: 900,
              absoluteChange: -100,
              percentageChange: -10,
              direction: 'down'
            },
            engagementRate: {
              previous: 5,
              current: 4.2,
              absoluteChange: -0.8,
              percentageChange: -16,
              direction: 'down'
            },
            dataQuality: {
              completeMediaHistory: true
            },
            warnings: []
          },
          warnings: []
        }
      };
    }
  };

  const service = new OnDemandGrowthService(history);

  assert.equal(calls, 0, 'No background analysis allowed.');

  const result = await service.analyze('owner-a', accountId);

  assert.equal(result.ok, true);
  assert.equal(calls, 1);

  assert.ok(result.data.advice.experiments.length > 0);

  assert.equal(
    result.data.decisions.decisions[0].priority,
    'high'
  );

  assert.ok(result.data.decisions.decisions.some(
    decision => decision.id === 'investigate-follower-decline'
  ));

  assert.ok(result.data.decisions.decisions.every(
    decision => decision.requiresApproval === true
  ));

  console.log('PASS: On-demand analysis and decisions verified.');
});

test('provider failure does not generate decisions', async () => {
  const failure = {
    ok: false,
    source: 'mock',
    error: {
      code: 'NETWORK_ERROR',
      message: 'Simulated failure',
      retryable: true
    }
  };

  const service = new OnDemandGrowthService({
    async analyzeAndRecord() {
      return failure;
    }
  });

  const result = await service.analyze('owner-a', accountId);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'NETWORK_ERROR');
  assert.equal('data' in result, false);

  console.log('PASS: Provider errors propagated safely.');
});
