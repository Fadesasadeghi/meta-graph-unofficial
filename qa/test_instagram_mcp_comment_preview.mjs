import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import {
  AccountStore
} from '../dist/accounts/account_store.js';

import {
  CommentReplySettingsStore
} from '../dist/comments/comment_reply_settings_store.js';

import {
  DEFAULT_REPLY_POLICY
} from '../dist/comments/comment_auto_reply_policy.js';

function parseResult(result) {
  const text = result.content.find(
    item => item.type === 'text'
  )?.text;

  assert.equal(typeof text, 'string');

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

test('MCP comment preview respects account safety settings', {
  timeout: 20000
}, async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'mcp-comment-preview-')
  );

  const accountsDir = join(root, 'accounts');
  const settingsDir = join(root, 'settings');

  const accounts = new AccountStore(accountsDir);

  let client;

  try {
    const account = await accounts.create({
      ownerId: 'preview-test-owner',
      username: 'preview.test',
      accountType: 'business'
    });

    const otherAccount = await accounts.create({
      ownerId: 'another-owner',
      username: 'another.preview.test',
      accountType: 'creator'
    });

    const settingsStore = new CommentReplySettingsStore(
      accounts,
      settingsDir
    );

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['dist/mcp/server.js'],
      env: {
        ...process.env,
        OFFLINE_MODE: 'true',
        INSTAGRAM_LOCAL_OWNER_ID: 'preview-test-owner',
        INSTAGRAM_ACCOUNTS_DIR: accountsDir,
        INSTAGRAM_COMMENT_SETTINGS_DIR: settingsDir
      }
    });

    client = new Client(
      {
        name: 'comment-preview-test',
        version: '1.0.0'
      },
      { capabilities: {} }
    );

    await client.connect(transport);

    const { tools } = await client.listTools();

    assert.ok(
      tools.some(
        tool => tool.name === 'instagram_preview_comment_reply'
      )
    );

    console.log(
      `PASS: Comment preview registered (${tools.length} tools).`
    );

    async function preview(accountId, commentId, text) {
      const result = await client.callTool({
        name: 'instagram_preview_comment_reply',
        arguments: {
          accountId,
          commentId,
          text
        }
      });

      return {
        result,
        data: parseResult(result)
      };
    }

    const initial = await preview(
      account.id,
      'comment-1',
      'قیمت این محصول چقدره؟'
    );

    assert.notEqual(initial.result.isError, true);
    assert.equal(initial.data.mode, 'manual');
    assert.equal(initial.data.executed, false);

    console.log('PASS: Default mode is manual.');

    await settingsStore.save(
      'preview-test-owner',
      account.id,
      {
        autoReplyEnabled: true,
        policy: { ...DEFAULT_REPLY_POLICY },
        approvedTemplates: {
          compliment: 'ممنون از محبتت 💛',
          pricing: 'لطفاً مدل محصول را مشخص کن.',
          product_question: 'لطفاً نام محصول را بفرست.'
        }
      }
    );

    const pricing = await preview(
      account.id,
      'comment-2',
      'قیمت این محصول چقدره؟'
    );

    assert.notEqual(pricing.result.isError, true);
    assert.equal(pricing.data.category, 'pricing');
    assert.equal(pricing.data.mode, 'auto');
    assert.equal(
      pricing.data.suggestedReply,
      'لطفاً مدل محصول را مشخص کن.'
    );
    assert.equal(pricing.data.executed, false);

    console.log('PASS: Approved pricing template selected.');

    const complaint = await preview(
      account.id,
      'comment-3',
      'محصول خراب بود و ناراضی هستم'
    );

    assert.equal(complaint.data.mode, 'manual');
    assert.equal(complaint.data.requiresApproval, true);
    assert.equal(complaint.data.executed, false);

    console.log('PASS: Complaint requires manual review.');

    const unauthorized = await preview(
      otherAccount.id,
      'comment-4',
      'خیلی عالی بود!'
    );

    assert.equal(unauthorized.result.isError, true);

    console.log('PASS: Unauthorized account rejected.');

    await settingsStore.save(
      'preview-test-owner',
      account.id,
      {
        autoReplyEnabled: false,
        policy: { ...DEFAULT_REPLY_POLICY },
        approvedTemplates: {
          pricing: 'لطفاً مدل محصول را مشخص کن.'
        }
      }
    );

    const disabled = await preview(
      account.id,
      'comment-5',
      'قیمت این محصول چقدره؟'
    );

    assert.equal(disabled.data.mode, 'manual');
    assert.equal(disabled.data.executed, false);

    console.log('PASS: Disabling auto reply takes effect.');
    console.log('PASS: No Instagram replies were sent.');
  } finally {
    if (client) {
      await client.close();
    }

    await rm(root, {
      recursive: true,
      force: true
    });
  }
});
