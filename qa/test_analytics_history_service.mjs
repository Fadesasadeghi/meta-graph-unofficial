import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { InstagramAnalyticsService } from '../dist/analytics/instagram_analytics_service.js';
import { AnalyticsSnapshotStore } from '../dist/analytics/analytics_snapshot_store.js';
import { AnalyticsHistoryService } from '../dist/analytics/analytics_history_service.js';

test('analytics history records and compares mock reports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-history-test-'));

  try {
    const accounts = new AccountStore(join(root, 'accounts'));

    const account = await accounts.create({
      ownerId: 'owner-a',
      username: 'demo.account',
      accountType: 'business'
    });

    let followers = 1000;
    let providerCalls = 0;

    const provider = {
      source: 'mock',

      async getProfile(accountId) {
        providerCalls++;

        return {
          ok: true,
          source: 'mock',
          fetchedAt: new Date().toISOString(),
          data: {
            id: accountId,
            username: 'demo.account',
            fullName: null,
            biography: null,
            followersCount: followers,
            followingCount: 100,
            mediaCount: 1,
            isVerified: false
          }
        };
      },

      async listMedia(accountId) {
        return {
          ok: true,
          source: 'mock',
          fetchedAt: new Date().toISOString(),
          data: {
            items: [{
              id: 'post-1',
              accountId,
              type: 'image',
              caption: 'Test post',
              publishedAt: '2026-11-01T10:00:00Z',
              permalink: null,
              likeCount: 50,
              commentCount: 10
            }],
            nextCursor: null
          }
        };
      }
    };

    const analytics = new InstagramAnalyticsService(provider);
    const snapshots = new AnalyticsSnapshotStore(
      accounts,
      join(root, 'snapshots')
    );

    const history = new AnalyticsHistoryService(
      analytics,
      snapshots
    );

    // First report: no previous history.
    const first = await history.analyzeAndRecord(
      'owner-a',
      account.id
    );

    assert.equal(first.ok, true);
    assert.equal(first.data.trend, null);
    assert.equal(first.data.report.followersCount, 1000);

    followers = 1200;

    // Make the previous snapshot timestamp safely earlier.
    await new Promise(resolve => setTimeout(resolve, 15));

    const second = await history.analyzeAndRecord(
      'owner-a',
      account.id
    );

    assert.equal(second.ok, true);
    assert.ok(second.data.trend);
    assert.equal(
      second.data.trend.followers.percentageChange,
      20
    );

    const saved = await snapshots.list('owner-a', account.id);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].source, 'mock');

    // Unauthorized owner must be rejected before provider access.
    const callsBefore = providerCalls;

    await assert.rejects(
      () => history.analyzeAndRecord('owner-b', account.id),
      /Account not found for this owner/
    );

    assert.equal(providerCalls, callsBefore);

    console.log('PASS: First snapshot saved.');
    console.log('PASS: Second snapshot compared.');
    console.log('PASS: Follower growth calculated correctly.');
    console.log('PASS: Unauthorized access blocked before provider call.');
    console.log('PASS: No live Instagram requests.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
