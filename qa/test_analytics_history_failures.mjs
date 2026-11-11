import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { AnalyticsSnapshotStore } from '../dist/analytics/analytics_snapshot_store.js';
import { AnalyticsHistoryService } from '../dist/analytics/analytics_history_service.js';

test('history rejects invalid provider results without saving', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-history-errors-'));

  try {
    const accounts = new AccountStore(join(root, 'accounts'));
    const snapshots = new AnalyticsSnapshotStore(
      accounts,
      join(root, 'snapshots')
    );

    const account = await accounts.create({
      ownerId: 'owner-a',
      username: 'demo.account',
      accountType: 'business'
    });

    const validReport = {
      accountId: account.id,
      username: account.username,
      source: 'mock',
      analyzedAt: new Date().toISOString(),
      followersCount: 100,
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

    const makeService = result =>
      new AnalyticsHistoryService(
        { analyzeAccount: async () => result },
        snapshots
      );

    const failure = await makeService({
      ok: false,
      source: 'mock',
      error: {
        code: 'NETWORK_ERROR',
        message: 'Simulated network failure',
        retryable: true
      }
    }).analyzeAndRecord('owner-a', account.id);

    assert.equal(failure.ok, false);
    assert.equal(
      (await snapshots.list('owner-a', account.id)).length,
      0
    );

    await assert.rejects(
      () => makeService({
        ok: true,
        source: 'mock',
        fetchedAt: new Date().toISOString(),
        data: {
          ...validReport,
          accountId: 'different-account'
        }
      }).analyzeAndRecord('owner-a', account.id),
      /account identity mismatch/
    );

    await assert.rejects(
      () => makeService({
        ok: true,
        source: 'live',
        fetchedAt: new Date().toISOString(),
        data: validReport
      }).analyzeAndRecord('owner-a', account.id),
      /source identity mismatch/
    );

    assert.equal(
      (await snapshots.list('owner-a', account.id)).length,
      0
    );

    console.log('PASS: Provider failure creates no snapshot.');
    console.log('PASS: Wrong account identity rejected.');
    console.log('PASS: Wrong source identity rejected.');
    console.log('PASS: No invalid history persisted.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
