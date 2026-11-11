import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountStore } from '../dist/accounts/account_store.js';
import { DirectReplySettingsStore } from '../dist/direct/direct_reply_settings_store.js';
import { DEFAULT_DIRECT_REPLY_POLICY } from '../dist/direct/direct_auto_reply_policy.js';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'direct-settings-'));

  const accountsDir = join(root, 'accounts');
  const settingsDir = join(root, 'settings');

  const accounts = new AccountStore(accountsDir);
  const store = new DirectReplySettingsStore(accounts, settingsDir);

  const accountA = await accounts.create({
    ownerId: 'owner-a',
    username: 'direct.settings.a',
    accountType: 'business'
  });

  const accountB = await accounts.create({
    ownerId: 'owner-a',
    username: 'direct.settings.b',
    accountType: 'creator'
  });

  return { root, accountsDir, settingsDir, store, accountA, accountB };
}

const enabledSettings = {
  autoReplyEnabled: true,
  policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
  approvedTemplates: {
    compliment: 'Thank you for your support!',
    pricing: 'Please send the product model.'
  }
};

test('auto replies are disabled by default', async () => {
  const ctx = await setup();

  try {
    const settings = await ctx.store.get('owner-a', ctx.accountA.id);
    assert.equal(settings.autoReplyEnabled, false);
    assert.deepEqual(settings.approvedTemplates, {});
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('saves approved templates and policies', async () => {
  const ctx = await setup();

  try {
    await ctx.store.save('owner-a', ctx.accountA.id, enabledSettings);

    const loaded = await ctx.store.get('owner-a', ctx.accountA.id);

    assert.equal(loaded.autoReplyEnabled, true);
    assert.equal(
      loaded.approvedTemplates.pricing,
      'Please send the product model.'
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('settings persist across store instances', async () => {
  const ctx = await setup();

  try {
    await ctx.store.save('owner-a', ctx.accountA.id, enabledSettings);

    const reopened = new DirectReplySettingsStore(
      new AccountStore(ctx.accountsDir),
      ctx.settingsDir
    );

    assert.equal(
      (await reopened.get('owner-a', ctx.accountA.id)).autoReplyEnabled,
      true
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('settings stay isolated by account and owner', async () => {
  const ctx = await setup();

  try {
    await ctx.store.save('owner-a', ctx.accountA.id, enabledSettings);

    const other = await ctx.store.get('owner-a', ctx.accountB.id);
    assert.equal(other.autoReplyEnabled, false);

    await assert.rejects(
      ctx.store.get('owner-b', ctx.accountA.id),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('unsafe policy overrides are rejected', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.store.save('owner-a', ctx.accountA.id, {
        ...enabledSettings,
        policy: {
          ...DEFAULT_DIRECT_REPLY_POLICY,
          complaint: 'auto'
        }
      }),
      /Unsafe categories cannot be automatic/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('templates for sensitive categories are rejected', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.store.save('owner-a', ctx.accountA.id, {
        ...enabledSettings,
        approvedTemplates: {
          complaint: 'Automatic complaint reply'
        }
      }),
      /Templates are restricted to safe categories/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
