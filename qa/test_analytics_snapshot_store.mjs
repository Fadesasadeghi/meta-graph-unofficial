import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { AnalyticsSnapshotStore } from '../dist/analytics/analytics_snapshot_store.js';

test('analytics snapshots persist and enforce ownership', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-analytics-test-'));

  try {
    const accounts = new AccountStore(join(root, 'accounts'));
    const storePath = join(root, 'snapshots');
    const store = new AnalyticsSnapshotStore(accounts, storePath);

    const account = await accounts.create({
      ownerId: 'owner-a',
      username: 'demo.account',
      accountType: 'business'
    });

    const other = await accounts.create({
      ownerId: 'owner-b',
      username: 'another.account',
      accountType: 'business'
    });

    const report = {
      accountId: account.id,
      username: account.username,
      source: 'mock',
      analyzedAt: new Date().toISOString(),
      followersCount: 100,
      analyzedPostCount: 1,
      averageEngagementRatePct: 5,
      engagementRateDenominator: 'followers',
      contentMix: { image: 1, video: 0, carousel: 0, reel: 0 },
      rankedPosts: [],
      dataQuality: {
        postsWithCompleteEngagement: 1,
        postsWithMissingEngagement: 0,
        completeMediaHistory: true
      },
      recommendations: []
    };

    const first = await store.save('owner-a', report);

    assert.equal(first.source, 'mock');
    assert.equal(first.report.followersCount, 100);

    report.followersCount = 200;

    const second = await store.save('owner-a', report);

    assert.notEqual(first.id, second.id);

    const reopened = new AnalyticsSnapshotStore(accounts, storePath);
    const history = await reopened.list('owner-a', account.id);

    assert.equal(history.length, 2);
    assert.deepEqual(
      history.map(item => item.report.followersCount).sort(),
      [100, 200]
    );

    assert.deepEqual(
      await reopened.list('owner-b', other.id),
      []
    );

    await assert.rejects(
      () => reopened.list('owner-b', account.id),
      /Account not found for this owner/
    );

    await assert.rejects(
      () => reopened.save('owner-b', report),
      /Account not found for this owner/
    );

    console.log('PASS: Snapshot persistence verified.');
    console.log('PASS: Historical reports remain independent.');
    console.log('PASS: Account ownership enforced.');
    console.log('PASS: Mock data stored with provenance.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
