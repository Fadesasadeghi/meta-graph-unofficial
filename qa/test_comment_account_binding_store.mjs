import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AccountStore
} from '../dist/accounts/account_store.js';

import {
  CommentAccountBindingStore
} from '../dist/comments/comment_account_binding_store.js';

async function setup() {
  const root = await mkdtemp(
    join(tmpdir(), 'comment-binding-test-')
  );

  const accountsDir = join(root, 'accounts');
  const bindingsDir = join(root, 'bindings');

  const accounts = new AccountStore(accountsDir);

  const store = new CommentAccountBindingStore(
    accounts,
    bindingsDir
  );

  const accountA = await accounts.create({
    ownerId: 'owner-a',
    username: 'binding.demo.a',
    accountType: 'business'
  });

  const accountB = await accounts.create({
    ownerId: 'owner-a',
    username: 'binding.demo.b',
    accountType: 'creator'
  });

  const accountC = await accounts.create({
    ownerId: 'owner-b',
    username: 'binding.demo.c',
    accountType: 'business'
  });

  return {
    root,
    accountsDir,
    bindingsDir,
    accounts,
    store,
    accountA,
    accountB,
    accountC
  };
}

test('creates and reads a valid mock binding', async () => {
  const ctx = await setup();

  try {
    const created = await ctx.store.bindMock(
      'owner-a',
      ctx.accountA.id,
      'demo-account-1'
    );

    const loaded = await ctx.store.get(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(created.providerSource, 'mock');
    assert.equal(created.providerAccountId, 'demo-account-1');
    assert.deepEqual(loaded, created);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('binding persists after reopening the store', async () => {
  const ctx = await setup();

  try {
    await ctx.store.bindMock(
      'owner-a',
      ctx.accountA.id,
      'demo-account-1'
    );

    const reopened = new CommentAccountBindingStore(
      new AccountStore(ctx.accountsDir),
      ctx.bindingsDir
    );

    const loaded = await reopened.get(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(loaded?.providerAccountId, 'demo-account-1');
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('repeated binding is idempotent', async () => {
  const ctx = await setup();

  try {
    const first = await ctx.store.bindMock(
      'owner-a',
      ctx.accountA.id,
      'demo-account-1'
    );

    const second = await ctx.store.bindMock(
      'owner-a',
      ctx.accountA.id,
      'demo-account-1'
    );

    assert.deepEqual(second, first);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('bindings are isolated between owners and accounts', async () => {
  const ctx = await setup();

  try {
    await ctx.store.bindMock(
      'owner-a',
      ctx.accountA.id,
      'demo-account-1'
    );

    const accountB = await ctx.store.get(
      'owner-a',
      ctx.accountB.id
    );

    const accountC = await ctx.store.get(
      'owner-b',
      ctx.accountC.id
    );

    assert.equal(accountB, null);
    assert.equal(accountC, null);

    await assert.rejects(
      ctx.store.get('owner-b', ctx.accountA.id),
      /Account not found for this owner/
    );

    await assert.rejects(
      ctx.store.bindMock(
        'owner-b',
        ctx.accountA.id,
        'demo-account-1'
      ),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects invalid provider account IDs', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.store.bindMock(
        'owner-a',
        ctx.accountA.id,
        'unknown-provider-account'
      ),
      /Only the demo mock account is supported/
    );

    const loaded = await ctx.store.get(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(loaded, null);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
