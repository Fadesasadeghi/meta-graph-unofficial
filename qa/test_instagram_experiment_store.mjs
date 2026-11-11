import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { ExperimentStore } from '../dist/experiments/experiment_store.js';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'instagram-experiments-'));
  const accounts = new AccountStore(join(root, 'accounts'));
  const directory = join(root, 'experiments');
  const store = new ExperimentStore(accounts, directory);

  const accountA = await accounts.create({
    ownerId: 'owner-a',
    username: 'experiment.test.a',
    accountType: 'creator'
  });

  const accountB = await accounts.create({
    ownerId: 'owner-b',
    username: 'experiment.test.b',
    accountType: 'creator'
  });

  return { root, accounts, directory, store, accountA, accountB };
}

function input(accountId) {
  return {
    accountId,
    adviceExperimentId: 'repeat-top-content-pattern',
    title: 'Test a new reel',
    hypothesis: 'A new opening may improve engagement.',
    metric: 'engagement_rate',
    baseline: {
      value: 5.5,
      measuredAt: '2026-11-01T12:00:00.000Z',
      source: 'mock'
    }
  };
}

test('creates an experiment with planned status', async () => {
  const ctx = await setup();
  try {
    const record = await ctx.store.create(
      'owner-a',
      input(ctx.accountA.id)
    );

    assert.ok(record.id);
    assert.equal(record.status, 'planned');
    assert.equal(record.ownerId, 'owner-a');
    assert.equal(record.baseline.value, 5.5);
    assert.equal(record.outcome, null);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('persists experiments across store instances', async () => {
  const ctx = await setup();
  try {
    const created = await ctx.store.create(
      'owner-a',
      input(ctx.accountA.id)
    );

    const reopened = new ExperimentStore(
      ctx.accounts,
      ctx.directory
    );

    const records = await reopened.list('owner-a', ctx.accountA.id);

    assert.equal(records.length, 1);
    assert.equal(records[0].id, created.id);
    assert.equal(records[0].title, created.title);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('isolates experiments between accounts', async () => {
  const ctx = await setup();
  try {
    await ctx.store.create('owner-a', input(ctx.accountA.id));

    const other = await ctx.store.list('owner-b', ctx.accountB.id);
    assert.equal(other.length, 0);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects cross-owner access', async () => {
  const ctx = await setup();
  try {
    await assert.rejects(
      ctx.store.create('owner-b', input(ctx.accountA.id)),
      /Account not found for this owner/
    );

    await assert.rejects(
      ctx.store.list('owner-b', ctx.accountA.id),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects invalid measurements and metrics', async () => {
  const ctx = await setup();
  try {
    await assert.rejects(
      ctx.store.create('owner-a', {
        ...input(ctx.accountA.id),
        baseline: {
          value: -10,
          measuredAt: new Date().toISOString(),
          source: 'mock'
        }
      }),
      /non-negative/
    );

    await assert.rejects(
      ctx.store.create('owner-a', {
        ...input(ctx.accountA.id),
        metric: 'fake_metric'
      }),
      /Invalid experiment metric/
    );

    assert.equal(
      (await ctx.store.list('owner-a', ctx.accountA.id)).length,
      0
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
