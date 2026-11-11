import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
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
import { MockAutoCommentExecutor } from '../dist/comments/mock_auto_comment_executor.js';
import { DEFAULT_REPLY_POLICY } from '../dist/comments/comment_auto_reply_policy.js';

test('MOCK automatic comment execution is safe and idempotent', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'auto-comment-test-')
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

    const verified = new VerifiedCommentReplyService(
      bindings,
      new VerifiedCommentLookup(new MockInstagramProvider()),
      new CommentReplyService(settings)
    );

    const executionsDir = join(root, 'executions');

    const executor = new MockAutoCommentExecutor(
      verified,
      executionsDir
    );

    const accountA = await accounts.create({
      ownerId: 'owner-a',
      username: 'auto.comment.a',
      accountType: 'business'
    });

    const accountB = await accounts.create({
      ownerId: 'owner-a',
      username: 'auto.comment.b',
      accountType: 'creator'
    });

    await bindings.bindMock(
      'owner-a',
      accountA.id,
      'demo-account-1'
    );

    await bindings.bindMock(
      'owner-a',
      accountB.id,
      'demo-account-1'
    );

    const execute = (accountId, commentId = 'demo-comment-1') =>
      executor.execute(
        'owner-a',
        accountId,
        'demo-post-1',
        commentId
      );

    const enable = async accountId => {
      await settings.save('owner-a', accountId, {
        autoReplyEnabled: true,
        policy: { ...DEFAULT_REPLY_POLICY },
        approvedTemplates: {
          compliment: 'Thanks for your support! 💛'
        }
      });
    };

    // 1. Auto Reply disabled: no execution.
    await assert.rejects(
      execute(accountA.id),
      /not eligible for automatic reply/
    );

    console.log('PASS: Disabled automatic replies are blocked.');

    // 2. Execute a verified, approved MOCK reply.
    await enable(accountA.id);

    // First-time concurrent requests share one exclusive claim.
    const firstAttempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        execute(accountA.id)
      )
    );

    const successful = firstAttempts
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    assert.ok(successful.length >= 1);

    const first = successful[0];

    assert.ok(
      successful.every(
        result =>
          result.status === 'completed' &&
          result.resultId === first.resultId
      )
    );

    const failures = firstAttempts.filter(
      result => result.status === 'rejected'
    );

    assert.ok(
      failures.every(result =>
        /reconciliation required/i.test(
          String(result.reason)
        )
      )
    );

    console.log(
      'PASS: Cold concurrent execution allows one result; in-progress calls fail closed.'
    );

    assert.equal(first.status, 'completed');
    assert.equal(first.simulated, true);
    assert.equal(first.providerAccountId, 'demo-account-1');
    assert.equal(first.commentId, 'demo-comment-1');
    assert.ok(first.resultId?.startsWith('mock-'));

    console.log('PASS: Approved MOCK reply executed.');

    // 3. Same comment returns the existing receipt.
    const duplicate = await execute(accountA.id);

    assert.deepEqual(duplicate, first);

    console.log('PASS: Repeated execution returns existing receipt.');

    // 4. Concurrent requests share one execution result.
    const concurrent = await Promise.all(
      Array.from({ length: 10 }, () =>
        execute(accountA.id)
      )
    );

    assert.ok(
      concurrent.every(
        result => result.resultId === first.resultId
      )
    );

    console.log('PASS: Concurrent requests do not duplicate execution.');

    // 5. Two internal accounts share the provider-level claim.
    await enable(accountB.id);

    const secondAccount = await execute(accountB.id);

    assert.deepEqual(secondAccount, first);

    console.log('PASS: Shared provider prevents duplicate replies.');

    // 6. Execution receipt persists across instances.
    const reopened = new MockAutoCommentExecutor(
      verified,
      executionsDir
    );

    const persisted = await reopened.execute(
      'owner-a',
      accountA.id,
      'demo-post-1',
      'demo-comment-1'
    );

    assert.deepEqual(persisted, first);

    console.log('PASS: Execution receipt survives restart.');

    // A missing comment cannot be executed.
    await assert.rejects(
      execute(accountA.id, 'unknown-comment'),
      /Comment not found/
    );

    console.log('PASS: Unknown comments cannot execute.');

    // A previously claimed but unfinished operation must not retry.
    const uncertainDir = join(root, 'uncertain-executions');
    const hash = value => createHash('sha256')
      .update(value)
      .digest('hex');

    const claimedFolder = join(
      uncertainDir,
      hash('demo-account-1')
    );

    await mkdir(claimedFolder, { recursive: true });

    await writeFile(
      join(claimedFolder, hash('demo-comment-1') + '.json'),
      JSON.stringify({
        status: 'claimed',
        accountId: accountA.id,
        providerAccountId: 'demo-account-1',
        commentId: 'demo-comment-1'
      })
    );

    const uncertainExecutor = new MockAutoCommentExecutor(
      verified,
      uncertainDir
    );

    await assert.rejects(
      uncertainExecutor.execute(
        'owner-a',
        accountA.id,
        'demo-post-1',
        'demo-comment-1'
      ),
      /reconciliation required/
    );

    console.log('PASS: Interrupted execution is not automatically retried.');

    console.log('PASS: All MOCK execution checks completed.');
  } finally {
    await rm(root, {
      recursive: true,
      force: true
    });
  }
});
