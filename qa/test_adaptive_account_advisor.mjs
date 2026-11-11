import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adaptGrowthAdviceForAccount
} from '../dist/advisor/adaptive_account_advisor.js';

const template = {
  accountId: 'demo-account-1',
  username: 'demo.creator',
  source: 'mock',
  generatedAt: '2026-11-11T08:00:00Z',
  warnings: [],
  experiments: [{
    id: 'repeat-top-content-pattern',
    title: 'Test strongest content',
    hypothesis: 'A variation might perform better.',
    evidence: ['Demo example'],
    action: 'Test one variation.',
    successMetrics: ['Engagement rate'],
    confidence: 'low',
    limitations: ['Simulated evidence']
  }]
};

function trial(id, accountId) {
  return {
    id,
    ownerId: 'owner-a',
    accountId,
    adviceExperimentId: 'repeat-top-content-pattern',
    status: 'completed',
    metric: 'engagement_rate',
    baseline: {
      value: 5,
      source: 'mock',
      measuredAt: '2026-11-01T12:00:00Z'
    },
    outcome: {
      value: 7,
      source: 'mock',
      measuredAt: '2026-11-08T12:00:00Z'
    }
  };
}

test('adapts demo template using selected account history', () => {
  const report = adaptGrowthAdviceForAccount(
    template,
    'registered-account-a',
    [
      trial('1', 'registered-account-a'),
      trial('2', 'registered-account-a'),
      trial('3', 'registered-account-a')
    ]
  );

  assert.equal(report.accountId, 'registered-account-a');
  assert.equal(report.templateAccountId, 'demo-account-1');
  assert.equal(report.basedOnDemoTemplate, true);
  assert.equal(report.recommendations[0].priority, 'promising');
  assert.equal(report.recommendations[0].completedTrials, 3);
  assert.ok(report.warnings.some(
    warning => warning.includes('demo template')
  ));
});

test('ignores trials belonging to another account', () => {
  const report = adaptGrowthAdviceForAccount(
    template,
    'registered-account-a',
    [
      trial('1', 'another-account'),
      trial('2', 'another-account'),
      trial('3', 'another-account')
    ]
  );

  assert.equal(report.recommendations[0].completedTrials, 0);
  assert.equal(report.recommendations[0].priority, 'needs_testing');
});

test('rejects an incorrectly labeled live template', () => {
  assert.throws(
    () => adaptGrowthAdviceForAccount(
      { ...template, source: 'live' },
      'registered-account-a',
      []
    ),
    /mock templates/
  );
});
