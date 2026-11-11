import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AccountStore
} from '../dist/accounts/account_store.js';

import {
  CommentReplyReservationStore
} from '../dist/comments/comment_reply_reservation_store.js';

async function setup() {
  const root = await mkdtemp(
    join(tmpdir(), 'comment-reservation-test-')
  );

  const accounts = new AccountStore(
    join(root, 'accounts')
  );

  const directory = join(root, 'reservations');

  const store = new CommentReplyReservationStore(
    accounts,
    directory
  );

  const accountA = await accounts.create({
    ownerId: 'owner-a',
    username: 'reservation.demo.a',
    accountType: 'business'
  });

  const accountB = await accounts.create({
    ownerId: 'owner-a',
    username: 'reservation.demo.b',
    accountType: 'creator'
  });

  const accountC = await accounts.create({
    ownerId: 'owner-b',
    username: 'reservation.demo.c',
    accountType: 'business'
  });

  return {
    root,
    accounts,
    directory,
    store,
    accountA,
    accountB,
    accountC
  };
}

test('first reservation succeeds and duplicate is blocked', async () => {
  const ctx = await setup();

  try {
    const first = await ctx.store.reserve(
      'owner-a',
      ctx.accountA.id,
      'comment-1'
    );

    const second = await ctx.store.reserve(
      'owner-a',
      ctx.accountA.id,
      'comment-1'
    );

    assert.equal(first.status, 'reserved');
    assert.equal(second.status, 'duplicate');
    assert.equal(first.simulated, true);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('reservations persist across store instances', async () => {
  const ctx = await setup();

  try {
    await ctx.store.reserve(
      'owner-a',
      ctx.accountA.id,
      'comment-2'
    );

    const reopened = new CommentReplyReservationStore(
      new AccountStore(join(ctx.root, 'accounts')),
      ctx.directory
    );

    const result = await reopened.reserve(
      'owner-a',
      ctx.accountA.id,
      'comment-2'
    );

    assert.equal(result.status, 'duplicate');
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('concurrent reservations allow only one winner', async () => {
  const ctx = await setup();

  try {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        ctx.store.reserve(
          'owner-a',
          ctx.accountA.id,
          'comment-concurrent'
        )
      )
    );

    assert.equal(
      results.filter(r => r.status === 'reserved').length,
      1
    );

    assert.equal(
      results.filter(r => r.status === 'duplicate').length,
      9
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('reservations are isolated across accounts and owners', async () => {
  const ctx = await setup();

  try {
    const results = await Promise.all([
      ctx.store.reserve(
        'owner-a',
        ctx.accountA.id,
        'same-comment'
      ),
      ctx.store.reserve(
        'owner-a',
        ctx.accountB.id,
        'same-comment'
      ),
      ctx.store.reserve(
        'owner-b',
        ctx.accountC.id,
        'same-comment'
      )
    ]);

    assert.ok(
      results.every(r => r.status === 'reserved')
    );

    await assert.rejects(
      ctx.store.reserve(
        'owner-b',
        ctx.accountA.id,
        'comment-cross-owner'
      ),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('invalid IDs are rejected without reservation', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.store.reserve(
        'owner-a',
        ctx.accountA.id,
        '   '
      ),
      /Valid owner, account and comment IDs/
    );

    await assert.rejects(
      ctx.store.reserve(
        'owner-a',
        ctx.accountA.id,
        'x'.repeat(257)
      ),
      /Valid owner, account and comment IDs/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
