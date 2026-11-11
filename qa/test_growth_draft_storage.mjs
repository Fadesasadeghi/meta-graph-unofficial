import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { AccountDraftStore } from '../dist/accounts/account_draft_store.js';
import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';
import { InstagramAnalyticsService } from '../dist/analytics/instagram_analytics_service.js';
import { InstagramGrowthAdvisor } from '../dist/advisor/instagram_growth_advisor.js';
import { GrowthDraftPreparer } from '../dist/advisor/growth_draft_preparer.js';

test('growth preview can be saved only to the selected owner account', async () => {
  const root = await mkdtemp(join(tmpdir(), 'growth-draft-test-'));

  try {
    const accounts = new AccountStore(join(root, 'accounts'));
    const drafts = new AccountDraftStore(
      accounts,
      join(root, 'drafts')
    );

    const ownerA = 'test-owner-a';
    const ownerB = 'test-owner-b';

    const accountA = await accounts.create({
      ownerId: ownerA,
      username: 'test.account.a',
      accountType: 'creator'
    });

    const accountB = await accounts.create({
      ownerId: ownerB,
      username: 'test.account.b',
      accountType: 'creator'
    });

    const analytics = new InstagramAnalyticsService(
      new MockInstagramProvider()
    );

    const result = await analytics.analyzeAccount('demo-account-1');
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const advice = new InstagramGrowthAdvisor().generate(result.data);

    const preview = new GrowthDraftPreparer().prepare(
      advice,
      'repeat-top-content-pattern',
      'reel'
    );

    assert.equal(preview.source, 'mock');
    assert.equal(preview.saved, false);
    assert.equal(preview.requiresApproval, true);

    const storeA = await drafts.forAccount(ownerA, accountA.id);

    // Preview must not create any saved drafts.
    assert.equal((await storeA.list()).length, 0);

    // Simulate a separate, explicit save action.
    const saved = await storeA.create(preview.draft);

    assert.equal(saved.status, 'draft');
    assert.equal(saved.type, 'reel');
    assert.equal(saved.caption, preview.draft.caption);

    assert.equal((await storeA.list()).length, 1);

    // The other owner's account must remain untouched.
    const storeB = await drafts.forAccount(ownerB, accountB.id);
    assert.equal((await storeB.list()).length, 0);

    // Cross-owner access must be rejected.
    await assert.rejects(
      drafts.forAccount(ownerB, accountA.id),
      /Account not found for this owner/
    );

    console.log('PASS: Growth draft storage and owner isolation.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
