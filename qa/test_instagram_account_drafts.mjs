import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { AccountDraftStore } from '../dist/accounts/account_draft_store.js';

test('Instagram account drafts: isolation and persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'instagram-account-drafts-'));

  try {
    const accounts = new AccountStore(join(directory, 'accounts'));
    const accountDrafts = new AccountDraftStore(
      accounts,
      join(directory, 'drafts')
    );

    const firstAccount = await accounts.create({
      ownerId: 'user-a',
      username: 'personal.test',
      accountType: 'personal'
    });

    const secondAccount = await accounts.create({
      ownerId: 'user-a',
      username: 'creator.test',
      accountType: 'creator'
    });

    const otherOwnerAccount = await accounts.create({
      ownerId: 'user-b',
      username: 'business.test',
      accountType: 'business'
    });

    const firstStore = await accountDrafts.forAccount(
      'user-a',
      firstAccount.id
    );

    const secondStore = await accountDrafts.forAccount(
      'user-a',
      secondAccount.id
    );

    const otherStore = await accountDrafts.forAccount(
      'user-b',
      otherOwnerAccount.id
    );

    const draft = await firstStore.create({
      type: 'post',
      caption: 'Account isolation test'
    });

    await firstStore.create({
      type: 'reel',
      caption: 'Another draft'
    });

    await secondStore.create({
      type: 'story',
      caption: 'Second account draft'
    });

    assert.equal((await firstStore.list()).length, 2);
    assert.equal((await secondStore.list()).length, 1);
    assert.equal((await otherStore.list()).length, 0);

    await assert.rejects(
      accountDrafts.forAccount('user-b', firstAccount.id),
      /Account not found/
    );

    await assert.rejects(
      otherStore.get(draft.id),
      { code: 'ENOENT' }
    );

    const reloaded = new AccountDraftStore(
      new AccountStore(join(directory, 'accounts')),
      join(directory, 'drafts')
    );

    const persisted = await reloaded.forAccount(
      'user-a',
      firstAccount.id
    );

    assert.equal((await persisted.list()).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
