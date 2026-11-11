import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { AccountStore } from '../dist/accounts/account_store.js';
import { ActionQueue } from '../dist/actions/action_queue.js';
import { ActionApprovalStore } from '../dist/actions/action_approval_store.js';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'approval-test-'));
  const accounts = new AccountStore(join(root, 'accounts'));
  const queueDir = join(root, 'queue');
  const approvalDir = join(root, 'approvals');

  const queue = new ActionQueue(accounts, queueDir);
  const approvals = new ActionApprovalStore(
    accounts, queue, approvalDir
  );

  const account = await accounts.create({
    ownerId: 'owner-a',
    username: 'approval.demo',
    accountType: 'creator'
  });

  const action = await queue.enqueue(
    'owner-a',
    account.id,
    'test-story-key',
    {
      kind: 'publish',
      type: 'story',
      mediaUrl: 'https://example.com/story.jpg',
      caption: 'Test story'
    }
  );

  return {
    root, accounts, queue, queueDir,
    approvalDir, approvals, account, action
  };
}

async function cleanup(ctx) {
  await rm(ctx.root, { recursive: true, force: true });
}

test('approval is initially absent', async () => {
  const ctx = await setup();

  try {
    const result = await ctx.approvals.get(
      'owner-a', ctx.account.id, ctx.action.id
    );

    assert.equal(result, null);
  } finally {
    await cleanup(ctx);
  }
});

test('approval persists and cannot be overwritten', async () => {
  const ctx = await setup();

  try {
    const approved = await ctx.approvals.decide(
      'owner-a', ctx.account.id, ctx.action.id, 'approved'
    );

    assert.equal(approved.decision, 'approved');
    assert.ok(approved.actionHash);

    const reopened = new ActionApprovalStore(
      ctx.accounts,
      new ActionQueue(ctx.accounts, ctx.queueDir),
      ctx.approvalDir
    );

    const saved = await reopened.get(
      'owner-a', ctx.account.id, ctx.action.id
    );

    assert.equal(saved.decision, 'approved');
    assert.equal(saved.actionHash, approved.actionHash);

    await assert.rejects(
      reopened.decide(
        'owner-a', ctx.account.id, ctx.action.id, 'rejected'
      ),
      error => error?.code === 'EEXIST'
    );
  } finally {
    await cleanup(ctx);
  }
});

test('another owner cannot approve an action', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.approvals.decide(
        'owner-b', ctx.account.id, ctx.action.id, 'approved'
      ),
      /Account not found for this owner/
    );
  } finally {
    await cleanup(ctx);
  }
});

test('changing queued content invalidates approval', async () => {
  const ctx = await setup();

  try {
    await ctx.approvals.decide(
      'owner-a', ctx.account.id, ctx.action.id, 'approved'
    );

    const ownerHash = createHash('sha256')
      .update('owner-a').digest('hex');

    const keyHash = createHash('sha256')
      .update('test-story-key').digest('hex');

    const queueFile = join(
      ctx.queueDir,
      ownerHash,
      ctx.account.id,
      `${keyHash}.json`
    );

    const saved = JSON.parse(
      await readFile(queueFile, 'utf8')
    );

    saved.action.caption = 'Changed after approval';

    await writeFile(
      queueFile,
      JSON.stringify(saved, null, 2)
    );

    await assert.rejects(
      ctx.approvals.get(
        'owner-a', ctx.account.id, ctx.action.id
      ),
      /Action changed after approval/
    );
  } finally {
    await cleanup(ctx);
  }
});
