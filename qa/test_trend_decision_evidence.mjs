import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TrendDecisionEngine
} from '../dist/advisor/trend_decision_engine.js';

const engine = new TrendDecisionEngine();

const advice = {
  accountId: 'account-a',
  username: 'demo.account',
  source: 'mock',
  generatedAt: '2026-11-11T10:00:00Z',
  experiments: [],
  warnings: []
};

function createTrend({
  posts = 20,
  minutes = 1440
} = {}) {
  const current = Date.parse('2026-11-11T10:00:00Z');

  return {
    accountId: 'account-a',
    source: 'mock',
    previousSnapshotId: 'old',
    currentSnapshotId: 'new',
    previousDate:
      new Date(current - minutes * 60000).toISOString(),
    currentDate: new Date(current).toISOString(),

    followers: null,

    engagementRate: {
      previous: 5,
      current: 4,
      absoluteChange: -1,
      percentageChange: -20,
      direction: 'down'
    },

    dataQuality: {
      completeMediaHistory: true,
      previousCompletePosts: posts,
      currentCompletePosts: posts
    },

    warnings: []
  };
}

function engagementDecision(result) {
  return result.decisions.find(
    item => item.id === 'review-engagement-decline'
  );
}

test('limited post evidence must not produce high priority', () => {
  const result = engine.evaluate(
    advice,
    createTrend({ posts: 2 })
  );

  const decision = engagementDecision(result);

  assert.ok(decision);
  assert.notEqual(decision.priority, 'high');
});

test('very short comparison interval must not produce high priority', () => {
  const result = engine.evaluate(
    advice,
    createTrend({ minutes: 5 })
  );

  const decision = engagementDecision(result);

  assert.ok(decision);
  assert.notEqual(decision.priority, 'high');
});

test('adequate sample and interval preserve normal priority', () => {
  const result = engine.evaluate(
    advice,
    createTrend({ posts: 20, minutes: 1440 })
  );

  assert.equal(
    engagementDecision(result)?.priority,
    'high'
  );
});

test('unknown post counts must not produce high priority', () => {
  const trend = createTrend();

  delete trend.dataQuality.previousCompletePosts;
  delete trend.dataQuality.currentCompletePosts;

  const result = engine.evaluate(advice, trend);
  const decision = engagementDecision(result);

  assert.ok(decision);
  assert.notEqual(decision.priority, 'high');
});

test('invalid post counts must not produce high priority', () => {
  const trend = createTrend();

  trend.dataQuality.previousCompletePosts = NaN;

  const result = engine.evaluate(advice, trend);
  const decision = engagementDecision(result);

  assert.ok(decision);
  assert.notEqual(decision.priority, 'high');
});
