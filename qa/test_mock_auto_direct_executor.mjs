import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { CommentAccountBindingStore } from '../dist/comments/comment_account_binding_store.js';
import { MockDirectInboxProvider } from '../dist/providers/mock_direct_inbox_provider.js';
import { DirectReplySettingsStore } from '../dist/direct/direct_reply_settings_store.js';
import { VerifiedDirectReplyService } from '../dist/direct/verified_direct_reply_service.js';
import { MockAutoDirectExecutor } from '../dist/direct/mock_auto_direct_executor.js';
import { DEFAULT_DIRECT_REPLY_POLICY } from '../dist/direct/direct_auto_reply_policy.js';

const hash = value =>
  createHash('sha256').update(value).digest('hex');

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'auto-direct-test-'));
  const accounts = new AccountStore(join(root, 'accounts'));

  const accountA = await accounts.create({
    ownerId: 'owner-a',
    username: 'auto.direct.a',
    accountType: 'business'
  });

  const accountB = await accounts.create({
    ownerId: 'owner-a',
    username: 'auto.direct.b',
    accountType: 'creator'
  });

  const bindings = new CommentAccountBindingStore(
    accounts,
    join(root, 'bindings')
  );

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

  const settings = new DirectReplySettingsStore(
    accounts,
    join(root, 'settings')
  );

  const verified = new VerifiedDirectReplyService(
    bindings,
    new MockDirectInboxProvider(),
    settings
  );

  const executionsDir = join(root, 'executions');

  const executor = new MockAutoDirectExecutor(
    verified,
    executionsDir
  );

  const enable = accountId =>
    settings.save('owner-a', accountId, {
      autoReplyEnabled: true,
      policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
      approvedTemplates: {
        pricing: 'لطفاً مدل محصول را ارسال کنید.',
        compliment: 'ممنون از محبت شما!'
      }
    });

  const execute = (
    accountId = accountA.id,
    conversationId = 'demo-dm-pricing',
    messageId = 'demo-message-pricing-1'
  ) => executor.execute(
    'owner-a',
    accountId,
    conversationId,
    messageId
  );

  return {
    root,
    accountA,
    accountB,
    settings,
    verified,
    executor,
    executionsDir,
    enable,
    execute
  };
}

test('disabled auto replies cannot execute', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.execute(),
      /not eligible for automatic reply/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('approved pricing DM executes only in MOCK mode', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);

    const result = await ctx.execute();

    assert.equal(result.status, 'completed');
    assert.equal(result.simulated, true);
    assert.equal(result.providerAccountId, 'demo-account-1');
    assert.equal(result.conversationId, 'demo-dm-pricing');
    assert.equal(result.messageId, 'demo-message-pricing-1');
    assert.match(result.resultId, /^mock-/);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('duplicate requests reuse the persisted receipt', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);

    const first = await ctx.execute();
    const duplicate = await ctx.execute();

    assert.deepEqual(duplicate, first);

    const restarted = new MockAutoDirectExecutor(
      ctx.verified,
      ctx.executionsDir
    );

    const persisted = await restarted.execute(
      'owner-a',
      ctx.accountA.id,
      'demo-dm-pricing',
      'demo-message-pricing-1'
    );

    assert.deepEqual(persisted, first);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('cold concurrent executions allow only one completed result', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => ctx.execute())
    );

    const completed = attempts
      .filter(item => item.status === 'fulfilled')
      .map(item => item.value);

    assert.ok(completed.length >= 1);

    const resultIds = new Set(
      completed.map(item => item.resultId)
    );

    assert.equal(resultIds.size, 1);

    const rejected = attempts.filter(
      item => item.status === 'rejected'
    );

    assert.ok(rejected.every(
      item => /reconciliation required/i.test(String(item.reason))
    ));
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('internal accounts share one provider-level execution claim', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);
    await ctx.enable(ctx.accountB.id);

    const first = await ctx.execute(ctx.accountA.id);
    const second = await ctx.execute(ctx.accountB.id);

    assert.deepEqual(second, first);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('order support and spam cannot execute automatically', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);

    await assert.rejects(
      ctx.execute(
        ctx.accountA.id,
        'demo-dm-order',
        'demo-message-order-1'
      ),
      /not eligible for automatic reply/
    );

    await assert.rejects(
      ctx.execute(
        ctx.accountA.id,
        'demo-dm-spam',
        'demo-message-spam-1'
      ),
      /not eligible for automatic reply/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('unknown messages and unauthorized owners are rejected', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);

    await assert.rejects(
      ctx.execute(
        ctx.accountA.id,
        'demo-dm-pricing',
        'missing-message'
      ),
      /Message not found or ambiguous/
    );

    await assert.rejects(
      ctx.executor.execute(
        'other-owner',
        ctx.accountA.id,
        'demo-dm-pricing',
        'demo-message-pricing-1'
      ),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('claimed or malformed receipts require reconciliation', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);

    const folder = join(
      ctx.executionsDir,
      hash('demo-account-1')
    );

    await mkdir(folder, { recursive: true });

    const file = join(
      folder,
      `${hash(JSON.stringify([
        'demo-dm-pricing',
        'demo-message-pricing-1'
      ]))}.json`
    );

    await writeFile(file, JSON.stringify({
      status: 'claimed',
      accountId: ctx.accountA.id,
      providerAccountId: 'demo-account-1',
      conversationId: 'demo-dm-pricing',
      messageId: 'demo-message-pricing-1'
    }));

    await assert.rejects(
      ctx.execute(),
      /reconciliation required/
    );

    await writeFile(file, JSON.stringify({
      status: 'completed',
      accountId: ctx.accountA.id,
      providerAccountId: 'demo-account-1',
      conversationId: 'demo-dm-pricing',
      messageId: 'demo-message-pricing-1',
      simulated: true,
      resultId: null,
      reason: 'Invalid receipt',
      executedAt: null
    }));

    await assert.rejects(
      ctx.execute(),
      /reconciliation required/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('disabling auto replies prevents new executions', async () => {
  const ctx = await setup();

  try {
    await ctx.enable(ctx.accountA.id);

    await ctx.settings.save('owner-a', ctx.accountA.id, {
      autoReplyEnabled: false,
      policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
      approvedTemplates: {
        pricing: 'لطفاً مدل محصول را ارسال کنید.'
      }
    });

    await assert.rejects(
      ctx.execute(),
      /not eligible for automatic reply/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
