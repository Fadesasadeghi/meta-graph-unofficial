import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TrendDecisionEngine
} from '../dist/advisor/trend_decision_engine.js';

const engine = new TrendDecisionEngine();

function createAdvice() {
  return {
    accountId: 'account-a',
    username: 'demo.account',
    source: 'mock',
    generatedAt: '2026-11-11T10:00:00Z',
    warnings: [],
    experiments: [
      {
        id: 'content-test',
        title: 'Test content variation',
        hypothesis: 'Content variation may help.',
        evidence: ['Historical engagement'],
        action: 'Prepare an experiment.',
        successMetrics: ['Engagement rate'],
        confidence: 'low',
        limitations: []
      }
    ]
  };
}

function metric(change, percentageChange = change) {
  return {
    previous: 10,
    current: 10 + change,
    absoluteChange: change,
    percentageChange,
    direction:
      change < 0 ? 'down' :
      change > 0 ? 'up' : 'unchanged'
  };
}

function createTrend({
  engagement = -0.8,
  followers = -6,
  complete = true
} = {}) {
  return {
    accountId: 'account-a',
    source: 'mock',
    previousSnapshotId: 'old',
    currentSnapshotId: 'new',
    previousDate: '2026-11-01T10:00:00Z',
    currentDate: '2026-11-11T10:00:00Z',
    engagementRate:
      engagement === null ? null : metric(engagement),
    followers:
      followers === null
        ? null
        : metric(followers, followers),
    dataQuality: {
      completeMediaHistory: complete,
      previousCompletePosts: 20,
      currentCompletePosts: 20
    },
    warnings: []
  };
}

function findDecision(result, id) {
  return result.decisions.find(item => item.id === id);
}

test('engagement decline at threshold is high priority', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend({ engagement: -0.5, followers: 0 })
  );

  assert.equal(
    findDecision(result, 'review-engagement-decline')?.priority,
    'high'
  );
});

test('engagement decline below threshold is ignored', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend({ engagement: -0.49, followers: 0 })
  );

  assert.equal(
    findDecision(result, 'review-engagement-decline'),
    undefined
  );
});

test('follower decline at threshold is high priority', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend({ engagement: 0, followers: -5 })
  );

  assert.equal(
    findDecision(result, 'investigate-follower-decline')?.priority,
    'high'
  );
});

test('follower decline below threshold is ignored', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend({ engagement: 0, followers: -4.99 })
  );

  assert.equal(
    findDecision(result, 'investigate-follower-decline'),
    undefined
  );
});

test('incomplete media history lowers engagement priority', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend({
      engagement: -1,
      followers: 0,
      complete: false
    })
  );

  assert.equal(
    findDecision(result, 'review-engagement-decline')?.priority,
    'low'
  );
});

test('missing engagement does not create decline alert', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend({ engagement: null, followers: 0 })
  );

  assert.equal(
    findDecision(result, 'review-engagement-decline'),
    undefined
  );
});

test('mock analysis includes simulation warning', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend()
  );

  assert.ok(result.warnings.some(
    warning => warning.toLowerCase().includes('simulated')
  ));
});

test('all proposed actions need approval and are sorted', () => {
  const result = engine.evaluate(
    createAdvice(),
    createTrend()
  );

  const priorities = {
    high: 0,
    medium: 1,
    low: 2
  };

  assert.ok(result.decisions.every(
    decision => decision.requiresApproval === true
  ));

  for (let i = 1; i < result.decisions.length; i++) {
    assert.ok(
      priorities[result.decisions[i - 1].priority] <=
      priorities[result.decisions[i].priority]
    );
  }
});
