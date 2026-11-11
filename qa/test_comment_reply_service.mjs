import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AccountStore
} from '../dist/accounts/account_store.js';

import {
  CommentReplySettingsStore
} from '../dist/comments/comment_reply_settings_store.js';

import {
  CommentReplyService
} from '../dist/comments/comment_reply_service.js';

import {
  DEFAULT_REPLY_POLICY
} from '../dist/comments/comment_auto_reply_policy.js';

const templates = {
  compliment: 'Thank you so much for your support!',
  pricing: 'Please share the product model so we can check the price.',
  product_question: 'Please specify which product you mean.'
};

test('comment reply service respects account settings', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'comment-service-test-')
  );

  try {
    const accounts = new AccountStore(join(root, 'accounts'));
    const settingsStore = new CommentReplySettingsStore(
      accounts,
      join(root, 'settings')
    );

    const service = new CommentReplyService(settingsStore);

    const accountA = await accounts.create({
      ownerId: 'owner-a',
      username: 'comment.service.a',
      accountType: 'creator'
    });

    const accountB = await accounts.create({
      ownerId: 'owner-a',
      username: 'comment.service.b',
      accountType: 'business'
    });

    const accountC = await accounts.create({
      ownerId: 'owner-b',
      username: 'comment.service.c',
      accountType: 'creator'
    });

    const preview = (ownerId, accountId, commentId, text) =>
      service.preview(ownerId, accountId, {
        commentId,
        text
      });

    // 1. Default settings: auto reply is disabled.
    const initial = await preview(
      'owner-a',
      accountA.id,
      'comment-1',
      'How much does this item cost?'
    );

    assert.equal(initial.mode, 'manual');
    assert.equal(initial.executed, false);

    console.log('PASS: Auto reply disabled by default.');

    // 2. Enable approved templates for account A.
    await settingsStore.save(
      'owner-a',
      accountA.id,
      {
        autoReplyEnabled: true,
        policy: { ...DEFAULT_REPLY_POLICY },
        approvedTemplates: { ...templates }
      }
    );

    const pricing = await preview(
      'owner-a',
      accountA.id,
      'comment-2',
      'How much does this item cost?'
    );

    assert.equal(pricing.mode, 'auto');
    assert.equal(pricing.suggestedReply, templates.pricing);
    assert.equal(pricing.requiresApproval, false);
    assert.equal(pricing.executed, false);

    console.log('PASS: Pricing uses approved auto template.');

    // 3. Complaints still require review.
    const complaint = await preview(
      'owner-a',
      accountA.id,
      'comment-3',
      'The item arrived broken and I am disappointed.'
    );

    assert.equal(complaint.mode, 'manual');
    assert.equal(complaint.requiresApproval, true);

    console.log('PASS: Complaints require manual review.');

    // 4. Spam is skipped.
    const spam = await preview(
      'owner-a',
      accountA.id,
      'comment-4',
      'Free followers https://example.com'
    );

    assert.equal(spam.mode, 'skip');
    assert.equal(spam.suggestedReply, null);

    console.log('PASS: Spam is skipped.');

    // 5. Settings must not leak across accounts or owners.
    const accountBPreview = await preview(
      'owner-a',
      accountB.id,
      'comment-5',
      'Absolutely amazing!'
    );

    const accountCPreview = await preview(
      'owner-b',
      accountC.id,
      'comment-6',
      'Absolutely amazing!'
    );

    assert.equal(accountBPreview.mode, 'manual');
    assert.equal(accountCPreview.mode, 'manual');

    await assert.rejects(
      preview(
        'owner-b',
        accountA.id,
        'comment-7',
        'Absolutely amazing!'
      ),
      /Account not found for this owner/
    );

    console.log('PASS: Account and owner isolation enforced.');

    // 6. Turning off auto reply must take effect immediately.
    await settingsStore.save(
      'owner-a',
      accountA.id,
      {
        autoReplyEnabled: false,
        policy: { ...DEFAULT_REPLY_POLICY },
        approvedTemplates: { ...templates }
      }
    );

    const disabled = await preview(
      'owner-a',
      accountA.id,
      'comment-8',
      'How much does this item cost?'
    );

    assert.equal(disabled.mode, 'manual');
    assert.equal(disabled.autoReplyEnabled, false);

    console.log('PASS: Disabling auto reply changes decisions.');

    console.log('PASS: All six service scenarios verified.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
