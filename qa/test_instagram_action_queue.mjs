import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { ActionQueue } from '../dist/actions/action_queue.js';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'instagram-actions-'));

  const accounts = new AccountStore(join(root, 'accounts'));
  const directory = join(root, 'actions');
  const queue = new ActionQueue(accounts, directory);

  const accountA = await accounts.create({
    ownerId: 'owner-a',
    username: 'actions.test.a',
    accountType: 'creator'
  });

  const accountB = await accounts.create({
    ownerId: 'owner-b',
    username: 'actions.test.b',
    accountType: 'creator'
  });

  return { root, accounts, directory, queue, accountA, accountB };
}

function story() {
  return {
    kind: 'publish',
    type: 'story',
    mediaUrl: 'https://example.com/story.jpg',
    caption: 'Test story'
  };
}

test('queues a story without publishing it', async () => {
  const ctx = await setup();

  try {
    const record = await ctx.queue.enqueue(
      'owner-a',
      ctx.accountA.id,
      'story-001',
      story()
    );

    assert.ok(record.id);
    assert.equal(record.status, 'pending_approval');
    assert.equal(record.action.kind, 'publish');
    assert.equal(record.action.type, 'story');
    assert.equal(record.ownerId, 'owner-a');

    const records = await ctx.queue.list(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(records.length, 1);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('persists queued actions across instances', async () => {
  const ctx = await setup();

  try {
    const created = await ctx.queue.enqueue(
      'owner-a',
      ctx.accountA.id,
      'persistent-001',
      story()
    );

    const reopened = new ActionQueue(
      ctx.accounts,
      ctx.directory
    );

    const records = await reopened.list(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(records.length, 1);
    assert.equal(records[0].id, created.id);
    assert.equal(records[0].status, 'pending_approval');
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('reuses an existing action for the same key and payload', async () => {
  const ctx = await setup();

  try {
    const first = await ctx.queue.enqueue(
      'owner-a',
      ctx.accountA.id,
      'duplicate-001',
      story()
    );

    const second = await ctx.queue.enqueue(
      'owner-a',
      ctx.accountA.id,
      'duplicate-001',
      story()
    );

    assert.equal(first.id, second.id);

    const records = await ctx.queue.list(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(records.length, 1);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects key reuse with different content', async () => {
  const ctx = await setup();

  try {
    await ctx.queue.enqueue(
      'owner-a',
      ctx.accountA.id,
      'conflict-001',
      story()
    );

    await assert.rejects(
      ctx.queue.enqueue(
        'owner-a',
        ctx.accountA.id,
        'conflict-001',
        { ...story(), caption: 'Different content' }
      ),
      /different action/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('isolates accounts and rejects cross-owner access', async () => {
  const ctx = await setup();

  try {
    await ctx.queue.enqueue(
      'owner-a',
      ctx.accountA.id,
      'private-001',
      story()
    );

    assert.equal(
      (await ctx.queue.list('owner-b', ctx.accountB.id)).length,
      0
    );

    await assert.rejects(
      ctx.queue.list('owner-b', ctx.accountA.id),
      /Account not found for this owner/
    );

    await assert.rejects(
      ctx.queue.enqueue(
        'owner-b',
        ctx.accountA.id,
        'unauthorized-001',
        story()
      ),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects invalid actions and missing keys', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.queue.enqueue(
        'owner-a',
        ctx.accountA.id,
        '',
        story()
      ),
      /idempotencyKey/
    );

    await assert.rejects(
      ctx.queue.enqueue(
        'owner-a',
        ctx.accountA.id,
        'invalid-media',
        { ...story(), mediaUrl: 'file:///private/story.jpg' }
      ),
      /media URL/
    );

    await assert.rejects(
      ctx.queue.enqueue(
        'owner-a',
        ctx.accountA.id,
        'invalid-comment',
        { kind: 'comment_reply', commentId: '', text: 'Hello' }
      ),
      /Invalid comment reply/
    );

    await assert.rejects(
      ctx.queue.enqueue(
        'owner-a',
        ctx.accountA.id,
        'invalid-direct',
        { kind: 'direct_message', conversationId: 'chat-1', text: '' }
      ),
      /Invalid direct message/
    );

    assert.equal(
      (await ctx.queue.list('owner-a', ctx.accountA.id)).length,
      0
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
