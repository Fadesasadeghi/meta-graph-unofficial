import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  AccountStore
} from '../dist/accounts/account_store.js';

import {
  CommentReplySettingsStore
} from '../dist/comments/comment_reply_settings_store.js';

import {
  DEFAULT_REPLY_POLICY
} from '../dist/comments/comment_auto_reply_policy.js';

const templates = {
  compliment: 'خیلی ممنون از محبتت 💛',
  pricing: 'لطفاً مدل محصول رو مشخص کن تا قیمت بررسی بشه.',
  product_question: 'لطفاً محصول موردنظرت رو مشخص کن.'
};

async function setup() {
  const root = await mkdtemp(
    join(tmpdir(), 'comment-settings-test-')
  );

  const accounts = new AccountStore(
    join(root, 'accounts')
  );

  const directory = join(root, 'settings');

  const store = new CommentReplySettingsStore(
    accounts,
    directory
  );

  const accountA = await accounts.create({
    ownerId: 'owner-a',
    username: 'settings.demo.a',
    accountType: 'creator'
  });

  const accountB = await accounts.create({
    ownerId: 'owner-a',
    username: 'settings.demo.b',
    accountType: 'business'
  });

  const accountC = await accounts.create({
    ownerId: 'owner-b',
    username: 'settings.demo.c',
    accountType: 'creator'
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

function settings(enabled = true) {
  return {
    autoReplyEnabled: enabled,
    policy: { ...DEFAULT_REPLY_POLICY },
    approvedTemplates: { ...templates }
  };
}

test('auto replies are disabled by default', async () => {
  const ctx = await setup();

  try {
    const result = await ctx.store.get(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(result.autoReplyEnabled, false);
    assert.deepEqual(result.approvedTemplates, {});
    assert.equal(result.updatedAt, null);

    assert.equal(result.policy.compliment, 'auto');
    assert.equal(result.policy.pricing, 'auto');
    assert.equal(result.policy.product_question, 'auto');
    assert.equal(result.policy.complaint, 'manual');
    assert.equal(result.policy.spam, 'skip');
    assert.equal(result.policy.general, 'manual');
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('saves selected policies and approved templates', async () => {
  const ctx = await setup();

  try {
    const result = await ctx.store.save(
      'owner-a',
      ctx.accountA.id,
      settings()
    );

    assert.equal(result.autoReplyEnabled, true);
    assert.deepEqual(result.policy, DEFAULT_REPLY_POLICY);
    assert.deepEqual(result.approvedTemplates, templates);
    assert.ok(result.updatedAt);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('settings persist after reopening the store', async () => {
  const ctx = await setup();

  try {
    await ctx.store.save(
      'owner-a',
      ctx.accountA.id,
      settings()
    );

    const reopened = new CommentReplySettingsStore(
      new AccountStore(join(ctx.root, 'accounts')),
      ctx.directory
    );

    const result = await reopened.get(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(result.autoReplyEnabled, true);
    assert.deepEqual(result.approvedTemplates, templates);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('isolates settings across accounts and owners', async () => {
  const ctx = await setup();

  try {
    await ctx.store.save(
      'owner-a',
      ctx.accountA.id,
      settings()
    );

    const anotherAccount = await ctx.store.get(
      'owner-a',
      ctx.accountB.id
    );

    const anotherOwner = await ctx.store.get(
      'owner-b',
      ctx.accountC.id
    );

    assert.equal(anotherAccount.autoReplyEnabled, false);
    assert.equal(anotherOwner.autoReplyEnabled, false);

    await assert.rejects(
      ctx.store.get('owner-b', ctx.accountA.id),
      /Account not found for this owner/
    );

    await assert.rejects(
      ctx.store.save(
        'owner-b',
        ctx.accountA.id,
        settings()
      ),
      /Account not found for this owner/
    );
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});

test('rejects invalid policies and templates', async () => {
  const ctx = await setup();

  try {
    await assert.rejects(
      ctx.store.save(
        'owner-a',
        ctx.accountA.id,
        {
          ...settings(),
          autoReplyEnabled: 'yes'
        }
      ),
      /Invalid autoReplyEnabled/
    );

    await assert.rejects(
      ctx.store.save(
        'owner-a',
        ctx.accountA.id,
        {
          ...settings(),
          policy: {
            ...DEFAULT_REPLY_POLICY,
            complaint: 'auto-now'
          }
        }
      ),
      /Invalid reply policy/
    );

    await assert.rejects(
      ctx.store.save(
        'owner-a',
        ctx.accountA.id,
        {
          ...settings(),
          approvedTemplates: {
            compliment: ' '
          }
        }
      ),
      /Invalid approved reply template/
    );

    const result = await ctx.store.get(
      'owner-a',
      ctx.accountA.id
    );

    assert.equal(result.autoReplyEnabled, false);
  } finally {
    await rm(ctx.root, { recursive: true, force: true });
  }
});
