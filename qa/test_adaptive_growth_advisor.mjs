import test from 'node:test';
import assert from 'node:assert/strict';

import { AdaptiveGrowthAdvisor } from '../dist/advisor/adaptive_growth_advisor.js';

const advisor = new AdaptiveGrowthAdvisor();

function advice(source = 'mock') {
  return {
    accountId: 'demo-account-1',
    username: 'demo.creator',
    source,
    generatedAt: new Date().toISOString(),
    warnings: [],
    experiments: [{
      id: 'repeat-top-content-pattern',
      title: 'Repeat strongest content',
      hypothesis: 'A similar format may improve engagement.',
      evidence: ['Previous strong post'],
      action: 'Test one variation.',
      successMetrics: ['Follower-based engagement rate'],
      confidence: 'low',
      limitations: ['Results are not causal evidence.']
    }]
  };
}

function trial(id, baseline, outcome, overrides = {}) {
  return {
    id: `trial-${id}`,
    ownerId: 'owner-a',
    accountId: 'demo-account-1',
    adviceExperimentId: 'repeat-top-content-pattern',
    title: 'Content test',
    hypothesis: 'Test engagement improvement.',
    status: 'completed',
    metric: 'engagement_rate',
    baseline: {
      value: baseline,
      source: 'mock',
      measuredAt: '2026-11-01T12:00:00Z'
    },
    outcome: {
      value: outcome,
      source: 'mock',
      measuredAt: '2026-11-08T12:00:00Z'
    },
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function firstRecommendation(history, source = 'mock') {
  return advisor.adapt(advice(source), history).recommendations[0];
}

test('marks repeated positive results as promising', () => {
  const result = firstRecommendation([
    trial(1, 5, 7),
    trial(2, 6, 8),
    trial(3, 4, 6)
  ]);

  assert.equal(result.completedTrials, 3);
  assert.equal(result.improvedTrials, 3);
  assert.equal(result.priority, 'promising');
});

test('reconsiders repeated negative results', () => {
  const result = firstRecommendation([
    trial(1, 7, 5),
    trial(2, 8, 6),
    trial(3, 6, 4)
  ]);

  assert.equal(result.declinedTrials, 3);
  assert.equal(result.priority, 'reconsider');
});

test('does not overinterpret small samples', () => {
  const result = firstRecommendation([
    trial(1, 5, 7),
    trial(2, 5, 8)
  ]);

  assert.equal(result.completedTrials, 2);
  assert.equal(result.priority, 'needs_testing');
});

test('ignores other accounts, experiments and incomplete trials', () => {
  const result = firstRecommendation([
    trial(1, 5, 7),
    trial(2, 5, 7, { accountId: 'another-account' }),
    trial(3, 5, 7, { adviceExperimentId: 'different-advice' }),
    trial(4, 5, 7, { status: 'running' }),
    trial(5, 5, 7, { metric: 'reach' })
  ]);

  assert.equal(result.completedTrials, 1);
  assert.equal(result.priority, 'needs_testing');
});

test('never mixes mock and live evidence', () => {
  const result = firstRecommendation([
    trial(1, 5, 7),
    trial(2, 5, 7),
    trial(3, 5, 7)
  ], 'live');

  assert.equal(result.completedTrials, 0);
  assert.equal(result.priority, 'needs_testing');

  const mockReport = advisor.adapt(advice(), []);

  assert.ok(
    mockReport.warnings.some(warning =>
      warning.includes('simulated data')
    )
  );
});
