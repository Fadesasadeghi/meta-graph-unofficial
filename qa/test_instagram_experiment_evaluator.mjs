import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateExperiment
} from '../dist/experiments/experiment_evaluator.js';

function experiment({
  baseline = 5.5,
  outcome = 7,
  baselineSource = 'mock',
  outcomeSource = 'mock',
  status = 'completed'
} = {}) {
  return {
    id: 'experiment-1',
    metric: 'engagement_rate',
    status,
    baseline: baseline === null ? null : {
      value: baseline,
      source: baselineSource,
      measuredAt: '2026-11-01T12:00:00.000Z'
    },
    outcome: outcome === null ? null : {
      value: outcome,
      source: outcomeSource,
      measuredAt: '2026-11-08T12:00:00.000Z'
    }
  };
}

test('evaluates improvement', () => {
  const result = evaluateExperiment(experiment());

  assert.equal(result.conclusion, 'improved');
  assert.ok(Math.abs(result.absoluteChange - 1.5) < 1e-9);
  assert.equal(result.relativeChangePct, 27.27);
});

test('evaluates decline', () => {
  const result = evaluateExperiment(
    experiment({ baseline: 8, outcome: 6 })
  );

  assert.equal(result.conclusion, 'declined');
  assert.equal(result.absoluteChange, -2);
  assert.equal(result.relativeChangePct, -25);
});

test('detects unchanged results', () => {
  const result = evaluateExperiment(
    experiment({ baseline: 5, outcome: 5 })
  );

  assert.equal(result.conclusion, 'unchanged');
  assert.equal(result.relativeChangePct, 0);
});

test('rejects comparison between mock and live data', () => {
  const result = evaluateExperiment(
    experiment({ outcomeSource: 'live' })
  );

  assert.equal(result.conclusion, 'incomparable_sources');
  assert.equal(result.absoluteChange, null);
});

test('requires completed status and both measurements', () => {
  assert.equal(
    evaluateExperiment(
      experiment({ status: 'running' })
    ).conclusion,
    'insufficient_data'
  );

  assert.equal(
    evaluateExperiment(
      experiment({ outcome: null })
    ).conclusion,
    'insufficient_data'
  );
});

test('handles zero baseline without dividing by zero', () => {
  const result = evaluateExperiment(
    experiment({ baseline: 0, outcome: 10 })
  );

  assert.equal(result.conclusion, 'improved');
  assert.equal(result.absoluteChange, 10);
  assert.equal(result.relativeChangePct, null);
});
