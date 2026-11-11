import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { AccountStore } from '../dist/accounts/account_store.js';
import { CommentAccountBindingStore } from '../dist/comments/comment_account_binding_store.js';
import { CommentReplySettingsStore } from '../dist/comments/comment_reply_settings_store.js';
import { DEFAULT_REPLY_POLICY } from '../dist/comments/comment_auto_reply_policy.js';

test('MCP executes approved auto comments in MOCK mode only', {
  timeout: 30000
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-auto-comment-'));
  const accountsDir = join(root, 'accounts');
  const bindingsDir = join(root, 'bindings');
  const settingsDir = join(root, 'settings');
  const executionsDir = join(root, 'executions');

  const accounts = new AccountStore(accountsDir);
  let client;

  try {
    const account = await accounts.create({
      ownerId: 'auto-test-owner',
      username: 'mcp.auto.comment',
      accountType: 'business'
    });

    const other = await accounts.create({
      ownerId: 'another-owner',
      username: 'mcp.other.comment',
      accountType: 'creator'
    });

    const bindings = new CommentAccountBindingStore(
      accounts,
      bindingsDir
    );

    await bindings.bindMock(
      'auto-test-owner',
      account.id,
      'demo-account-1'
    );

    const settings = new CommentReplySettingsStore(
      accounts,
      settingsDir
    );

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['dist/mcp/server.js'],
      env: {
        ...process.env,
        OFFLINE_MODE: 'true',
        INSTAGRAM_LOCAL_OWNER_ID: 'auto-test-owner',
        INSTAGRAM_ACCOUNTS_DIR: accountsDir,
        INSTAGRAM_COMMENT_BINDINGS_DIR: bindingsDir,
        INSTAGRAM_COMMENT_SETTINGS_DIR: settingsDir,
        INSTAGRAM_AUTO_COMMENT_EXECUTIONS_DIR: executionsDir
      }
    });

    client = new Client(
      {
        name: 'mcp-auto-comment-test',
        version: '1.0.0'
      },
      { capabilities: {} }
    );

    await client.connect(transport);

    const { tools } = await client.listTools();
    const toolName = 'instagram_execute_mock_auto_comment_reply';

    assert.ok(tools.some(tool => tool.name === toolName));

    console.log(
      `PASS: MOCK auto comment tool registered (${tools.length} tools).`
    );

    async function execute(accountId, commentId = 'demo-comment-1') {
      const result = await client.callTool({
        name: toolName,
        arguments: {
          accountId,
          mediaId: 'demo-post-1',
          commentId
        }
      });

      const text = result.content.find(
        item => item.type === 'text'
      )?.text;

      let data = {};

      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      return { result, data };
    }

    // 1. Disabled by default.
    const disabled = await execute(account.id);
    assert.equal(disabled.result.isError, true);
    console.log('PASS: Disabled auto replies rejected.');

    // 2. Enable a pre-approved template.
    await settings.save('auto-test-owner', account.id, {
      autoReplyEnabled: true,
      policy: { ...DEFAULT_REPLY_POLICY },
      approvedTemplates: {
        compliment: 'Thanks for your support! 💛'
      }
    });

    const first = await execute(account.id);

    assert.notEqual(first.result.isError, true);
    assert.equal(first.data.status, 'completed');
    assert.equal(first.data.simulated, true);
    assert.equal(first.data.providerAccountId, 'demo-account-1');
    assert.ok(first.data.resultId?.startsWith('mock-'));

    console.log('PASS: Approved comment executed in MOCK mode.');

    // 3. Replaying the request must not execute twice.
    const repeated = await execute(account.id);
    assert.deepEqual(repeated.data, first.data);

    console.log('PASS: Repeated execution reused existing receipt.');

    // 4. Disable auto reply for subsequent operations.
    await settings.save('auto-test-owner', account.id, {
      autoReplyEnabled: false,
      policy: { ...DEFAULT_REPLY_POLICY },
      approvedTemplates: {
        compliment: 'Thanks for your support! 💛'
      }
    });

    // The previously completed action may return its old receipt,
    // but new execution must not be permitted.
    const afterDisable = await execute(account.id);

    assert.equal(afterDisable.result.isError, true);
    console.log('PASS: Disabled policy blocks execution requests.');

    // 5. Cross-owner access must fail.
    const unauthorized = await execute(other.id);
    assert.equal(unauthorized.result.isError, true);

    console.log('PASS: Cross-owner execution rejected.');

    // 6. Nonexistent comments must fail.
    const unknown = await execute(account.id, 'unknown-comment');
    assert.equal(unknown.result.isError, true);

    console.log('PASS: Unknown comment rejected.');
    console.log('PASS: No real Instagram replies were sent.');
  } finally {
    if (client) await client.close();
    await rm(root, { recursive: true, force: true });
  }
});
