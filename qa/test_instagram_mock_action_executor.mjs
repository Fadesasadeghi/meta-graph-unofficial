import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  readFile,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { AccountStore } from '../dist/accounts/account_store.js';
import { ActionQueue } from '../dist/actions/action_queue.js';
import { ActionApprovalStore } from '../dist/actions/action_approval_store.js';
import { MockActionExecutor } from '../dist/actions/mock_action_executor.js';

async function setup() {
  const root = await mkdtemp(
    join(tmpdir(), 'instagram-executor-test-')
  );

  const accounts = new AccountStore(join(root, 'accounts'));
  const queueDir = join(root, 'queue');
  const approvalDir = join(root, 'approvals');
  const executionDir = join(root, 'executions');

  const queue = new ActionQueue(accounts, queueDir);
  const approvals = new ActionApprovalStore(
    accounts, queue, approvalDir
  );
  const executor = new MockActionExecutor(
    queue, approvals, executionDir
  );

  const account = await accounts.create({
    ownerId: 'owner-a',
    username: 'executor.demo',
    accountType: 'creator'
  });

  const action = await queue.enqueue(
    'owner-a',
    account.id,
    'story-execution-key',
    {
      kind: 'publish',
      type: 'story',
      mediaUrl: 'https://example.com/story.jpg',
      caption: 'Our test story'
    }
  );

  return {
    root, accounts, queue, queueDir,
    approvalDir, executionDir,
    approvals, executor, account, action
  };
}

async function cleanup(ctx) {
  await rm(ctx.root, {
    recursive: true,
    force: true
  });
}

function execute(ctx, ownerId = 'owner-a') {
  return ctx.executor.execute(
    ownerId,
    ctx.account.id,
    ctx.action.id
  );
}

test('blocks execution without approval', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      execute(ctx),
      /not approved/
    );
  } finally {
    await cleanup(ctx);
  }
});

test('blocks a rejected action', async () => {
  const ctx = await setup();

  try {
    await ctx.approvals.decide(
      'owner-a',
      ctx.account.id,
      ctx.action.id,
      'rejected'
    );

    await assert.rejects(
      execute(ctx),
      /not approved/
    );
  } finally {
    await cleanup(ctx);
  }
});

test('executes an approved story in mock mode', async () => {
  const ctx = await setup();

  try {
    await ctx.approvals.decide(
      'owner-a',
      ctx.account.id,
      ctx.action.id,
      'approved'
    );

    const receipt = await execute(ctx);

    assert.equal(receipt.status, 'completed');
    assert.equal(receipt.simulated, true);
    assert.equal(receipt.accountId, ctx.account.id);
    assert.ok(receipt.resultId.startsWith('mock-'));
  } finally {
    await cleanup(ctx);
  }
});

test('does not execute the same action twice', async () => {
  const ctx = await setup();

  try {
    await ctx.approvals.decide(
      'owner-a',
      ctx.account.id,
      ctx.action.id,
      'approved'
    );

    const first = await execute(ctx);

    const reopened = new MockActionExecutor(
      ctx.queue,
      ctx.approvals,
      ctx.executionDir
    );

    const second = await reopened.execute(
      'owner-a',
      ctx.account.id,
      ctx.action.id
    );

    assert.deepEqual(second, first);
  } finally {
    await cleanup(ctx);
  }
});

test('rejects execution after approved content changes', async () => {
  const ctx = await setup();

  try {
    await ctx.approvals.decide(
      'owner-a',
      ctx.account.id,
      ctx.action.id,
      'approved'
    );

    const ownerHash = createHash('sha256')
      .update('owner-a')
      .digest('hex');

    const keyHash = createHash('sha256')
      .update('story-execution-key')
      .digest('hex');

    const file = join(
      ctx.queueDir,
      ownerHash,
      ctx.account.id,
      `${keyHash}.json`
    );

    const record = JSON.parse(
      await readFile(file, 'utf8')
    );

    record.action.mediaUrl =
      'https://example.com/changed-story.jpg';

    await writeFile(
      file,
      JSON.stringify(record, null, 2)
    );

    await assert.rejects(
      execute(ctx),
      /Action changed after approval/
    );
  } finally {
    await cleanup(ctx);
  }
});

test('rejects execution from another owner', async () => {
  const ctx = await setup();

  try {
    await ctx.approvals.decide(
      'owner-a',
      ctx.account.id,
      ctx.action.id,
      'approved'
    );

    await assert.rejects(
      execute(ctx, 'owner-b'),
      /Account not found for this owner/
    );
  } finally {
    await cleanup(ctx);
  }
});
