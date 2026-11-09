import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountStore } from '../dist/accounts/account_store.js';

test('Instagram accounts: owner isolation and safe defaults', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'instagram-accounts-test-'));

  try {
    const store = new AccountStore(directory);

    const personal = await store.create({
      ownerId: 'user-a',
      username: 'personal.test',
      accountType: 'personal'
    });

    const creator = await store.create({
      ownerId: 'user-a',
      username: 'creator.test',
      accountType: 'creator'
    });

    const business = await store.create({
      ownerId: 'user-b',
      username: 'business.test',
      accountType: 'business'
    });

    assert.notEqual(personal.id, creator.id);
    assert.notEqual(creator.id, business.id);

    const reloaded = new AccountStore(directory);
    const accountsA = await reloaded.list('user-a');
    const accountsB = await reloaded.list('user-b');

    assert.equal(accountsA.length, 2);
    assert.equal(accountsB.length, 1);

    assert.ok(accountsA.every(a => a.ownerId === 'user-a'));
    assert.ok(accountsB.every(a => a.ownerId === 'user-b'));

    for (const account of [...accountsA, ...accountsB]) {
      assert.equal(account.connectionStatus, 'local');
      assert.deepEqual(account.capabilities, ['drafts', 'scheduling']);
      assert.equal(account.metaUserId, undefined);
    }

    await assert.rejects(
      store.create({
        ownerId: '',
        username: 'invalid',
        accountType: 'personal'
      }),
      /ownerId/
    );

    await assert.rejects(
      store.create({
        ownerId: 'user-a',
        username: '../invalid',
        accountType: 'personal'
      }),
      /Invalid Instagram username/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
