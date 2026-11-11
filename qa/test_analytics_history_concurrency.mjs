import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { AnalyticsSnapshotStore } from '../dist/analytics/analytics_snapshot_store.js';
import { AnalyticsHistoryService } from '../dist/analytics/analytics_history_service.js';

test('concurrent analysis should not both miss prior history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-concurrency-'));

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

    let call = 0;

    const analytics = {
      async analyzeAccount(accountId) {
        call++;
        const currentCall = call;

        await new Promise(resolve => setTimeout(resolve, 30));

        const report = {
          accountId,
          username: 'demo.account',
          source: 'mock',
          analyzedAt: new Date().toISOString(),
          followersCount: 1000 + currentCall * 100,
          analyzedPostCount: 0,
          averageEngagementRatePct: null,
          engagementRateDenominator: 'followers',
          contentMix: {
            image: 0,
            video: 0,
            carousel: 0,
            reel: 0
          },
          rankedPosts: [],
          dataQuality: {
            postsWithCompleteEngagement: 0,
            postsWithMissingEngagement: 0,
            completeMediaHistory: true
          },
          recommendations: []
        };

        return {
          ok: true,
          source: 'mock',
          fetchedAt: report.analyzedAt,
          data: report
        };
      }
    };

    const service = new AnalyticsHistoryService(
      analytics,
      store
    );

    const results = await Promise.all([
      service.analyzeAndRecord('owner-a', account.id),
      service.analyzeAndRecord('owner-a', account.id)
    ]);

    assert.equal(results.filter(r => r.ok).length, 2);

    const saved = await store.list('owner-a', account.id);
    assert.equal(saved.length, 2);

    const trends = results.filter(
      r => r.ok && r.data.trend !== null
    );

    assert.equal(
      trends.length,
      1,
      'Exactly one concurrent result should compare against prior history.'
    );

    console.log('PASS: Two snapshots persisted.');
    console.log('PASS: One result contains trend comparison.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
