import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { CommentAccountBindingStore } from '../dist/comments/comment_account_binding_store.js';
import { MockDirectInboxProvider } from '../dist/providers/mock_direct_inbox_provider.js';
import { DirectReplySettingsStore } from '../dist/direct/direct_reply_settings_store.js';
import { VerifiedDirectReplyService } from '../dist/direct/verified_direct_reply_service.js';
import { DEFAULT_DIRECT_REPLY_POLICY } from '../dist/direct/direct_auto_reply_policy.js';

test('verified direct reply decisions enforce account and message identity', async () => {
  const root = await mkdtemp(join(tmpdir(), 'verified-direct-'));

  try {
    const accounts = new AccountStore(join(root, 'accounts'));

    const accountA = await accounts.create({
      ownerId: 'owner-a',
      username: 'verified.direct.a',
      accountType: 'business'
    });

    const accountB = await accounts.create({
      ownerId: 'owner-a',
      username: 'verified.direct.b',
      accountType: 'creator'
    });

    const bindings = new CommentAccountBindingStore(
      accounts,
      join(root, 'bindings')
    );

    const settings = new DirectReplySettingsStore(
      accounts,
      join(root, 'settings')
    );

    const service = new VerifiedDirectReplyService(
      bindings,
      new MockDirectInboxProvider(),
      settings
    );

    const preview = (
      accountId,
      conversationId = 'demo-dm-pricing',
      messageId = 'demo-message-pricing-1',
      ownerId = 'owner-a'
    ) => service.preview(
      ownerId,
      accountId,
      conversationId,
      messageId
    );

    await assert.rejects(
      preview(accountA.id),
      /verified MOCK account binding is required/
    );

    console.log('PASS: Missing binding rejected.');

    await bindings.bindMock(
      'owner-a',
      accountA.id,
      'demo-account-1'
    );

    const initial = await preview(accountA.id);

    assert.equal(initial.category, 'pricing');
    assert.equal(initial.mode, 'manual');
    assert.equal(initial.executed, false);
    assert.equal(initial.simulated, true);

    console.log('PASS: Default mode is manual.');

    await settings.save('owner-a', accountA.id, {
      autoReplyEnabled: true,
      policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
      approvedTemplates: {
        pricing: 'Please send the product model.',
        compliment: 'Thank you for your support!'
      }
    });

    const pricing = await preview(accountA.id);

    assert.equal(pricing.mode, 'auto');
    assert.equal(
      pricing.reply,
      'Please send the product model.'
    );
    assert.equal(
      pricing.messageText,
      'Hi, how much is this item?'
    );
    assert.equal(pricing.executed, false);

    console.log('PASS: Approved pricing template selected.');

    const order = await preview(
      accountA.id,
      'demo-dm-order',
      'demo-message-order-1'
    );

    assert.equal(order.category, 'order_support');
    assert.equal(order.mode, 'manual');

    console.log('PASS: Order support requires human review.');

    const spam = await preview(
      accountA.id,
      'demo-dm-spam',
      'demo-message-spam-1'
    );

    assert.equal(spam.mode, 'skip');
    assert.equal(spam.reply, null);

    console.log('PASS: Spam is skipped.');

    await assert.rejects(
      preview(accountB.id),
      /verified MOCK account binding is required/
    );

    await assert.rejects(
      preview(
        accountA.id,
        'demo-dm-pricing',
        'demo-message-pricing-1',
        'owner-b'
      ),
      /Account not found for this owner/
    );

    console.log('PASS: Account ownership enforced.');

    await assert.rejects(
      preview(
        accountA.id,
        'demo-dm-order',
        'demo-message-pricing-1'
      ),
      /Message not found or ambiguous/
    );

    console.log('PASS: Cross-conversation message rejected.');

    await settings.save('owner-a', accountA.id, {
      autoReplyEnabled: false,
      policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
      approvedTemplates: {
        pricing: 'Please send the product model.'
      }
    });

    const disabled = await preview(accountA.id);

    assert.equal(disabled.mode, 'manual');
    assert.equal(disabled.executed, false);

    console.log('PASS: Disabling auto replies takes effect.');
    console.log('PASS: No direct messages were sent.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
