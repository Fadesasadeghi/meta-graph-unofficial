import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  TrendDecisionEngine
} from '../dist/advisor/trend_decision_engine.js';

const engine = new TrendDecisionEngine();

function advice(source = 'mock') {
  return {
    accountId: 'account-a',
    username: 'demo.account',
    source,
    generatedAt: new Date().toISOString(),
    warnings: [],
    experiments: [{
      id: 'test-content',
      title: 'Test better content',
      hypothesis: 'New content may improve engagement.',
      evidence: ['Existing post performance'],
      action: 'Prepare a controlled content experiment.',
      successMetrics: ['Engagement rate'],
      confidence: 'low',
      limitations: []
    }]
  };
}

function trend({
  source = 'mock',
  accountId = 'account-a',
  engagementChange = -0.8,
  followerChange = -6
} = {}) {
  return {
    accountId,
    source,
    previousSnapshotId: 'old',
    currentSnapshotId: 'new',
    previousDate: '2026-11-01T00:00:00Z',
    currentDate: '2026-11-08T00:00:00Z',
    warnings: [],
    dataQuality: {
      completeMediaHistory: true,
      previousCompletePosts: 20,
      currentCompletePosts: 20
    },
    engagementRate: {
      previous: 5,
      current: 5 + engagementChange,
      absoluteChange: engagementChange,
      percentageChange: engagementChange * 20,
      direction: engagementChange < 0 ? 'down' : 'up'
    },
    followers: {
      previous: 1000,
      current: 1000 * (1 + followerChange / 100),
      absoluteChange: followerChange * 10,
      percentageChange: followerChange,
      direction: followerChange < 0 ? 'down' : 'up'
    }
  };
}

test('detects engagement decline', () => {
  const result = engine.evaluate(advice(), trend());

  assert.ok(result.decisions.some(
    d => d.id === 'review-engagement-decline' &&
         d.priority === 'high'
  ));
});

test('detects follower decline', () => {
  const result = engine.evaluate(advice(), trend());

  assert.ok(result.decisions.some(
    d => d.id === 'investigate-follower-decline' &&
         d.priority === 'high'
  ));
});

test('prioritizes urgent decisions', () => {
  const result = engine.evaluate(advice(), trend());

  assert.equal(result.decisions[0].priority, 'high');
  assert.equal(result.decisions.at(-1).priority, 'medium');

  assert.ok(result.decisions.every(
    d => d.requiresApproval === true
  ));
});

test('rejects different accounts', () => {
  assert.throws(
    () => engine.evaluate(
      advice(),
      trend({ accountId: 'account-b' })
    ),
    /do not match/
  );
});

test('rejects mixing mock and live', () => {
  assert.throws(
    () => engine.evaluate(
      advice(),
      trend({ source: 'live' })
    ),
    /do not match/
  );
});

test('handles missing history', () => {
  const result = engine.evaluate(advice(), null);

  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].priority, 'medium');

  assert.ok(result.warnings.some(
    w => w.includes('No historical trend')
  ));
});

console.log('PASS: Decision engine scenarios completed.');

test('does not flag engagement decline as high priority with incomplete history', () => {
  const incomplete = trend();

  incomplete.dataQuality.completeMediaHistory = false;
  incomplete.warnings.push(
    'Incomplete media history may affect comparisons.'
  );

  const result = engine.evaluate(advice(), incomplete);

  assert.equal(
    result.decisions.some(
      d => d.id === 'review-engagement-decline' &&
           d.priority === 'high'
    ),
    false
  );

  assert.ok(
    result.warnings.some(
      w => w.includes('Incomplete media history')
    )
  );
});

test('does not invent engagement decline when metric is unavailable', () => {
  const missing = trend();
  missing.engagementRate = null;

  const result = engine.evaluate(advice(), missing);

  assert.equal(
    result.decisions.some(
      d => d.id === 'review-engagement-decline'
    ),
    false
  );
});

test('downgrades engagement warning to low priority when history is incomplete', () => {
  const incomplete = trend();

  incomplete.dataQuality.completeMediaHistory = false;
  incomplete.warnings.push(
    'Incomplete media history may affect comparisons.'
  );

  const result = engine.evaluate(advice(), incomplete);

  const decision = result.decisions.find(
    item => item.id === 'review-engagement-decline'
  );

  assert.ok(decision);
  assert.equal(decision.priority, 'low');
});

test('uses structured quality instead of warning text', () => {
  const incomplete = trend();

  incomplete.dataQuality.completeMediaHistory = false;
  incomplete.warnings = ['A completely different warning message'];

  const result = engine.evaluate(advice(), incomplete);

  const decision = result.decisions.find(
    item => item.id === 'review-engagement-decline'
  );

  assert.ok(decision);
  assert.equal(decision.priority, 'low');
});
