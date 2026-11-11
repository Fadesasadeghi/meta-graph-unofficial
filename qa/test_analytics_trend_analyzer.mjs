import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AnalyticsTrendAnalyzer
} from '../dist/analytics/analytics_trend_analyzer.js';

const analyzer = new AnalyticsTrendAnalyzer();

function snapshot({
  id = 'snapshot-1',
  accountId = 'account-a',
  ownerId = 'owner-a',
  source = 'mock',
  capturedAt = '2026-11-01T10:00:00.000Z',
  followers = 1000,
  engagement = 5,
  complete = true
} = {}) {
  return {
    id,
    accountId,
    ownerId,
    source,
    capturedAt,
    report: {
      accountId,
      username: 'demo.account',
      source,
      analyzedAt: capturedAt,
      followersCount: followers,
      analyzedPostCount: 5,
      averageEngagementRatePct: engagement,
      engagementRateDenominator: 'followers',
      contentMix: {
        image: 2,
        video: 1,
        carousel: 1,
        reel: 1
      },
      rankedPosts: [],
      dataQuality: {
        postsWithCompleteEngagement: 5,
        postsWithMissingEngagement: 0,
        completeMediaHistory: complete
      },
      recommendations: []
    }
  };
}

const previous = snapshot();

const current = (overrides = {}) => snapshot({
  id: 'snapshot-2',
  capturedAt: '2026-11-08T10:00:00.000Z',
  ...overrides
});

test('calculates follower growth and engagement decline', () => {
  const result = analyzer.analyze(
    previous,
    current({ followers: 1200, engagement: 4.2 })
  );

  assert.equal(result.followers.absoluteChange, 200);
  assert.equal(result.followers.percentageChange, 20);
  assert.equal(result.followers.direction, 'up');

  assert.equal(result.engagementRate.absoluteChange, -0.8);
  assert.equal(result.engagementRate.percentageChange, -16);
  assert.equal(result.engagementRate.direction, 'down');

  assert.equal(result.source, 'mock');
  assert.ok(result.warnings.some(w => w.includes('simulated')));
});

test('handles zero baseline without division by zero', () => {
  const result = analyzer.analyze(
    snapshot({ followers: 0 }),
    current({ followers: 100 })
  );

  assert.equal(result.followers.absoluteChange, 100);
  assert.equal(result.followers.percentageChange, null);
});

test('handles unavailable metrics', () => {
  const result = analyzer.analyze(
    snapshot({ engagement: null }),
    current({ engagement: 4 })
  );

  assert.equal(result.engagementRate, null);
  assert.ok(result.warnings.includes('Engagement trend unavailable.'));
});

test('rejects different accounts', () => {
  assert.throws(
    () => analyzer.analyze(
      previous,
      current({ accountId: 'account-b' })
    ),
    /different accounts/
  );
});

test('rejects mixing live and mock sources', () => {
  assert.throws(
    () => analyzer.analyze(
      previous,
      current({ source: 'live' })
    ),
    /mix mock and live/
  );
});

test('rejects reversed or equal timestamps', () => {
  assert.throws(
    () => analyzer.analyze(
      previous,
      current({ capturedAt: previous.capturedAt })
    ),
    /chronologically ordered/
  );
});

test('warns when media history is incomplete', () => {
  const result = analyzer.analyze(
    snapshot({ complete: false }),
    current()
  );

  assert.ok(
    result.warnings.some(w => w.includes('Incomplete media history'))
  );
});

test('detects unchanged metrics', () => {
  const result = analyzer.analyze(previous, current());

  assert.equal(result.followers.direction, 'unchanged');
  assert.equal(result.followers.absoluteChange, 0);
  assert.equal(result.engagementRate.direction, 'unchanged');
});

console.log('Analytics Trend Analyzer tests loaded.');

test('exposes structured media-history quality', () => {
  const incomplete = analyzer.analyze(
    snapshot({ complete: false }),
    current()
  );

  const complete = analyzer.analyze(
    snapshot(),
    current()
  );

  assert.equal(
    incomplete.dataQuality.completeMediaHistory,
    false
  );

  assert.equal(
    complete.dataQuality.completeMediaHistory,
    true
  );
});
