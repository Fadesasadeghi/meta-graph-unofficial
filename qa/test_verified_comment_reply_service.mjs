import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';
import { CommentAccountBindingStore } from '../dist/comments/comment_account_binding_store.js';
import { VerifiedCommentLookup } from '../dist/comments/verified_comment_lookup.js';
import { CommentReplySettingsStore } from '../dist/comments/comment_reply_settings_store.js';
import { CommentReplyService } from '../dist/comments/comment_reply_service.js';
import { VerifiedCommentReplyService } from '../dist/comments/verified_comment_reply_service.js';
import { DEFAULT_REPLY_POLICY } from '../dist/comments/comment_auto_reply_policy.js';

test('verified comment reply respects binding and account policy', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'verified-comment-reply-')
  );

  try {
    const accounts = new AccountStore(join(root, 'accounts'));

    const bindings = new CommentAccountBindingStore(
      accounts,
      join(root, 'bindings')
    );

    const settings = new CommentReplySettingsStore(
      accounts,
      join(root, 'settings')
    );

    const service = new VerifiedCommentReplyService(
      bindings,
      new VerifiedCommentLookup(new MockInstagramProvider()),
      new CommentReplyService(settings)
    );

    const accountA = await accounts.create({
      ownerId: 'owner-a',
      username: 'verified.reply.a',
      accountType: 'business'
    });

    const accountB = await accounts.create({
      ownerId: 'owner-a',
      username: 'verified.reply.b',
      accountType: 'creator'
    });

    const preview = (ownerId, accountId, commentId = 'demo-comment-1') =>
      service.preview(
        ownerId,
        accountId,
        'demo-post-1',
        commentId
      );

    // 1. An unbound account must be rejected.
    await assert.rejects(
      preview('owner-a', accountA.id),
      /verified MOCK account binding is required/
    );

    console.log('PASS: Missing binding rejected.');

    await bindings.bindMock(
      'owner-a',
      accountA.id,
      'demo-account-1'
    );

    // 2. Default settings must not allow automatic replies.
    const initial = await preview('owner-a', accountA.id);

    assert.equal(initial.mode, 'manual');
    assert.equal(initial.commentText, 'Great content!');
    assert.equal(initial.providerSource, 'mock');
    assert.equal(initial.simulated, true);
    assert.equal(initial.executed, false);

    console.log('PASS: Verified comment defaults to manual.');

    // 3. Explicitly enable approved automatic replies.
    await settings.save('owner-a', accountA.id, {
      autoReplyEnabled: true,
      policy: { ...DEFAULT_REPLY_POLICY },
      approvedTemplates: {
        compliment: 'Thanks for your support! 💛'
      }
    });

    const automatic = await preview('owner-a', accountA.id);

    assert.equal(automatic.category, 'compliment');
    assert.equal(automatic.mode, 'auto');
    assert.equal(
      automatic.suggestedReply,
      'Thanks for your support! 💛'
    );
    assert.equal(automatic.executed, false);

    console.log('PASS: Verified comment selects approved auto reply.');

    // 4. Disabling auto replies must immediately change decisions.
    await settings.save('owner-a', accountA.id, {
      autoReplyEnabled: false,
      policy: { ...DEFAULT_REPLY_POLICY },
      approvedTemplates: {
        compliment: 'Thanks for your support! 💛'
      }
    });

    const disabled = await preview('owner-a', accountA.id);

    assert.equal(disabled.mode, 'manual');
    assert.equal(disabled.executed, false);

    console.log('PASS: Disabled auto reply returns manual.');

    // 5. Another internal account must not inherit the binding.
    await assert.rejects(
      preview('owner-a', accountB.id),
      /verified MOCK account binding is required/
    );

    await assert.rejects(
      preview('owner-b', accountA.id),
      /Account not found for this owner/
    );

    console.log('PASS: Account and owner isolation enforced.');

    // 6. A nonexistent comment must be rejected.
    await assert.rejects(
      preview('owner-a', accountA.id, 'missing-comment'),
      /Comment not found/
    );

    console.log('PASS: Unknown comment rejected.');
    console.log('PASS: All six scenarios verified without sending replies.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
