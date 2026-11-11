import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';
import { CommentAccountBindingStore } from '../dist/comments/comment_account_binding_store.js';
import { VerifiedCommentLookup } from '../dist/comments/verified_comment_lookup.js';
import { CommentReplySettingsStore } from '../dist/comments/comment_reply_settings_store.js';
import { CommentReplyService } from '../dist/comments/comment_reply_service.js';
import { VerifiedCommentReplyService } from '../dist/comments/verified_comment_reply_service.js';
import { MockAutoCommentExecutor } from '../dist/comments/mock_auto_comment_executor.js';
import { DEFAULT_REPLY_POLICY } from '../dist/comments/comment_auto_reply_policy.js';

test('rejects incomplete stored execution receipts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'receipt-validation-'));

  try {
    const accounts = new AccountStore(join(root, 'accounts'));

    const account = await accounts.create({
      ownerId: 'owner-a',
      username: 'receipt.test',
      accountType: 'business'
    });

    const bindings = new CommentAccountBindingStore(
      accounts,
      join(root, 'bindings')
    );

    await bindings.bindMock(
      'owner-a',
      account.id,
      'demo-account-1'
    );

    const settings = new CommentReplySettingsStore(
      accounts,
      join(root, 'settings')
    );

    await settings.save('owner-a', account.id, {
      autoReplyEnabled: true,
      policy: { ...DEFAULT_REPLY_POLICY },
      approvedTemplates: {
        compliment: 'Thanks!'
      }
    });

    const verified = new VerifiedCommentReplyService(
      bindings,
      new VerifiedCommentLookup(new MockInstagramProvider()),
      new CommentReplyService(settings)
    );

    const hash = value =>
      createHash('sha256').update(value).digest('hex');

    const folder = join(
      root,
      'executions',
      hash('demo-account-1')
    );

    await mkdir(folder, { recursive: true });

    const receiptPath = join(
      folder,
      `${hash('demo-comment-1')}.json`
    );

    const executor = new MockAutoCommentExecutor(
      verified,
      join(root, 'executions')
    );

    const execute = () => executor.execute(
      'owner-a',
      account.id,
      'demo-post-1',
      'demo-comment-1'
    );

    await writeFile(receiptPath, JSON.stringify({
      accountId: account.id,
      providerAccountId: 'demo-account-1',
      commentId: 'demo-comment-1',
      status: 'completed',
      simulated: true,
      resultId: null,
      reason: 'Incomplete receipt',
      executedAt: null
    }));

    await assert.rejects(
      execute(),
      /reconciliation required/
    );

    console.log('PASS: Incomplete completed receipt rejected.');

    await writeFile(receiptPath, JSON.stringify({
      accountId: account.id,
      providerAccountId: 'demo-account-1',
      commentId: 'demo-comment-1',
      status: 'blocked',
      simulated: true,
      resultId: 'mock-invalid',
      reason: 'Invalid blocked receipt',
      executedAt: null
    }));

    await assert.rejects(
      execute(),
      /reconciliation required/
    );

    console.log('PASS: Inconsistent blocked receipt rejected.');
    console.log('PASS: No mock reply was executed.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
