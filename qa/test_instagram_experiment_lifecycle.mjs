import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { ExperimentStore } from '../dist/experiments/experiment_store.js';
import { evaluateExperiment } from '../dist/experiments/experiment_evaluator.js';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'experiment-lifecycle-'));

  const accounts = new AccountStore(join(root, 'accounts'));
  const directory = join(root, 'experiments');
  const store = new ExperimentStore(accounts, directory);

  const account = await accounts.create({
    ownerId: 'owner-a',
    username: 'lifecycle.test',
    accountType: 'creator'
  });

  const experiment = await store.create('owner-a', {
    accountId: account.id,
    adviceExperimentId: 'repeat-top-content-pattern',
    title: 'Improve reel engagement',
    hypothesis: 'A better hook may increase engagement.',
    metric: 'engagement_rate',
    baseline: {
      value: 5.5,
      measuredAt: '2026-11-01T12:00:00.000Z',
      source: 'mock'
    }
  });

  return { root, accounts, directory, store, account, experiment };
}

const outcome = {
  value: 7,
  measuredAt: '2026-11-08T12:00:00.000Z',
  source: 'mock'
};

test('completes experiment and evaluates persisted outcome', async () => {
  const ctx = await setup();

  try {
    const running = await ctx.store.updateStatus(
      'owner-a',
      ctx.account.id,
      ctx.experiment.id,
      'running'
    );

    assert.equal(running.status, 'running');

    const completed = await ctx.store.updateStatus(
      'owner-a',
      ctx.account.id,
      ctx.experiment.id,
      'completed',
      outcome
    );

    assert.equal(completed.status, 'completed');
    assert.equal(completed.outcome.value, 7);

    const reopened = new ExperimentStore(
      ctx.accounts,
      ctx.directory
    );

    const [saved] = await reopened.list('owner-a', ctx.account.id);

    assert.equal(saved.status, 'completed');
    assert.equal(saved.outcome.value, 7);

    const evaluation = evaluateExperiment(saved);

    assert.equal(evaluation.conclusion, 'improved');
    assert.equal(evaluation.relativeChangePct, 27.27);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects invalid status transitions', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.store.updateStatus(
        'owner-a', ctx.account.id, ctx.experiment.id, 'completed', outcome
      ),
      /Invalid experiment status transition/
    );

    await ctx.store.updateStatus(
      'owner-a', ctx.account.id, ctx.experiment.id, 'cancelled'
    );

    await assert.rejects(
      ctx.store.updateStatus(
        'owner-a', ctx.account.id, ctx.experiment.id, 'running'
      ),
      /Invalid experiment status transition/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('requires an outcome before completion', async () => {
  const ctx = await setup();

  try {
    await ctx.store.updateStatus(
      'owner-a', ctx.account.id, ctx.experiment.id, 'running'
    );

    await assert.rejects(
      ctx.store.updateStatus(
        'owner-a', ctx.account.id, ctx.experiment.id, 'completed'
      ),
      /require an outcome/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects mixing mock and live measurements', async () => {
  const ctx = await setup();

  try {
    await ctx.store.updateStatus(
      'owner-a', ctx.account.id, ctx.experiment.id, 'running'
    );

    await assert.rejects(
      ctx.store.updateStatus(
        'owner-a',
        ctx.account.id,
        ctx.experiment.id,
        'completed',
        { ...outcome, source: 'live' }
      ),
      /sources must match/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects cross-owner updates', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.store.updateStatus(
        'owner-b',
        ctx.account.id,
        ctx.experiment.id,
        'running'
      ),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
