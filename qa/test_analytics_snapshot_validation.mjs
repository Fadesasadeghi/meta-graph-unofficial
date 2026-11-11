import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { AnalyticsSnapshotStore } from '../dist/analytics/analytics_snapshot_store.js';

test('snapshot store rejects invalid analytics metrics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-validation-'));

  try {
    const accounts = new AccountStore(join(root, 'accounts'));
    const account = await accounts.create({
      ownerId: 'owner-a',
      username: 'demo.account',
      accountType: 'business'
    });

    const store = new AnalyticsSnapshotStore(
      accounts,
      join(root, 'snapshots')
    );

    const valid = {
      accountId: account.id,
      username: account.username,
      source: 'mock',
      analyzedAt: new Date().toISOString(),
      followersCount: 1000,
      analyzedPostCount: 1,
      averageEngagementRatePct: 5,
      engagementRateDenominator: 'followers',
      contentMix: {
        image: 1,
        video: 0,
        carousel: 0,
        reel: 0
      },
      rankedPosts: [{
        id: 'post-1',
        type: 'image',
        publishedAt: '2026-11-01T10:00:00Z',
        likes: 40,
        comments: 10,
        engagementRatePct: 5
      }],
      dataQuality: {
        postsWithCompleteEngagement: 1,
        postsWithMissingEngagement: 0,
        completeMediaHistory: true
      },
      recommendations: []
    };

    const invalidReports = [
      { ...valid, followersCount: -100 },
      { ...valid, followersCount: NaN },
      { ...valid, averageEngagementRatePct: Infinity },
      { ...valid, averageEngagementRatePct: -5 },
      { ...valid, analyzedPostCount: 2 },
      {
        ...valid,
        contentMix: { ...valid.contentMix, image: -1 }
      },
      {
        ...valid,
        dataQuality: {
          ...valid.dataQuality,
          postsWithCompleteEngagement: 3
        }
      }
    ];

    let rejected = 0;

    for (const report of invalidReports) {
      try {
        await store.save('owner-a', report);
      } catch {
        rejected++;
      }
    }

    const saved = await store.list('owner-a', account.id);

    console.log('Invalid reports rejected:', rejected);
    console.log('Invalid reports persisted:', saved.length);

    assert.equal(rejected, invalidReports.length);
    assert.equal(saved.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
