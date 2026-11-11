import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { AccountStore } from '../dist/accounts/account_store.js';
import { CommentAccountBindingStore } from '../dist/comments/comment_account_binding_store.js';
import { DirectReplySettingsStore } from '../dist/direct/direct_reply_settings_store.js';
import { DEFAULT_DIRECT_REPLY_POLICY } from '../dist/direct/direct_auto_reply_policy.js';

const OWNER = 'direct-mcp-test-owner';

function parseResponse(response) {
  const item = response.content?.find(
    entry => entry.type === 'text'
  );

  assert.ok(item, 'MCP response must contain text');

  if (response.isError) {
    throw new Error(`Unexpected MCP error: ${item.text}`);
  }

  return JSON.parse(item.text);
}

async function connect(env) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env,
    stderr: 'pipe'
  });

  const client = new Client({
    name: 'mock-direct-integration-test',
    version: '1.0.0'
  });

  await client.connect(transport);
  return client;
}

async function call(client, name, args) {
  return client.callTool({
    name,
    arguments: args
  });
}

test('MCP direct workflow is isolated, authorized and idempotent', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'instagram-mcp-direct-')
  );

  const env = {
    ...process.env,
    INSTAGRAM_LOCAL_OWNER_ID: OWNER,
    INSTAGRAM_ACCOUNTS_DIR: join(root, 'accounts'),
    INSTAGRAM_COMMENT_BINDINGS_DIR: join(root, 'bindings'),
    INSTAGRAM_DIRECT_REPLY_SETTINGS_DIR: join(root, 'settings'),
    INSTAGRAM_AUTO_DIRECT_EXECUTIONS_DIR: join(root, 'executions')
  };

  let client;

  try {
    const accounts = new AccountStore(
      env.INSTAGRAM_ACCOUNTS_DIR
    );

    const account = await accounts.create({
      ownerId: OWNER,
      username: 'direct.mcp.demo',
      accountType: 'business'
    });

    const unbound = await accounts.create({
      ownerId: OWNER,
      username: 'direct.mcp.unbound',
      accountType: 'creator'
    });

    const bindings = new CommentAccountBindingStore(
      accounts,
      env.INSTAGRAM_COMMENT_BINDINGS_DIR
    );

    const settings = new DirectReplySettingsStore(
      accounts,
      env.INSTAGRAM_DIRECT_REPLY_SETTINGS_DIR
    );

    await bindings.bindMock(
      OWNER,
      account.id,
      'demo-account-1'
    );

    client = await connect(env);

    // 1. Tools are registered.
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 39);

    console.log('PASS: 39 MCP tools registered.');

    // 2. Unbound accounts cannot read the inbox.
    const denied = await call(
      client,
      'instagram_list_mock_direct_conversations',
      { accountId: unbound.id }
    );

    assert.equal(denied.isError, true);

    console.log('PASS: Unbound account rejected.');

    // 3. Bound account can list the mock conversations.
    const listed = parseResponse(
      await call(
        client,
        'instagram_list_mock_direct_conversations',
        { accountId: account.id }
      )
    );

    assert.equal(listed.simulated, true);
    assert.equal(listed.source, 'mock');
    assert.equal(listed.conversationIds.length, 4);
    assert.ok(
      listed.conversationIds.includes('demo-dm-pricing')
    );

    console.log('PASS: Authorized MOCK inbox accessible.');

    const args = {
      accountId: account.id,
      conversationId: 'demo-dm-pricing',
      messageId: 'demo-message-pricing-1'
    };

    // 4. Automatic replies are disabled by default.
    const initial = parseResponse(
      await call(
        client,
        'instagram_preview_mock_direct_reply',
        args
      )
    );

    assert.equal(initial.mode, 'manual');
    assert.equal(initial.executed, false);

    const blocked = await call(
      client,
      'instagram_execute_mock_auto_direct_reply',
      args
    );

    assert.equal(blocked.isError, true);

    console.log('PASS: Default auto execution blocked.');

    // 5. Enable explicitly approved templates.
    await settings.save(OWNER, account.id, {
      autoReplyEnabled: true,
      policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
      approvedTemplates: {
        pricing: 'Please send us the product model.',
        compliment: 'Thank you for your support!'
      }
    });

    const preview = parseResponse(
      await call(
        client,
        'instagram_preview_mock_direct_reply',
        args
      )
    );

    assert.equal(preview.mode, 'auto');
    assert.equal(
      preview.reply,
      'Please send us the product model.'
    );
    assert.equal(
      preview.messageText,
      'Hi, how much is this item?'
    );
    assert.equal(preview.executed, false);

    console.log('PASS: Approved template previewed.');

    // 6. Order support cannot be automated.
    const orderArgs = {
      accountId: account.id,
      conversationId: 'demo-dm-order',
      messageId: 'demo-message-order-1'
    };

    const order = parseResponse(
      await call(
        client,
        'instagram_preview_mock_direct_reply',
        orderArgs
      )
    );

    assert.equal(order.mode, 'manual');

    const rejectedOrder = await call(
      client,
      'instagram_execute_mock_auto_direct_reply',
      orderArgs
    );

    assert.equal(rejectedOrder.isError, true);

    console.log('PASS: Order support requires manual review.');

    // 7. Prevent cross-conversation message substitution.
    const invalid = await call(
      client,
      'instagram_preview_mock_direct_reply',
      {
        accountId: account.id,
        conversationId: 'demo-dm-order',
        messageId: 'demo-message-pricing-1'
      }
    );

    assert.equal(invalid.isError, true);

    console.log('PASS: Cross-conversation message rejected.');

    // 8. Execute the approved message in MOCK only.
    const executed = parseResponse(
      await call(
        client,
        'instagram_execute_mock_auto_direct_reply',
        args
      )
    );

    assert.equal(executed.status, 'completed');
    assert.equal(executed.simulated, true);
    assert.match(executed.resultId, /^mock-/);

    console.log('PASS: Approved MOCK execution completed.');

    // 9. Duplicate request must return the same receipt.
    const duplicate = parseResponse(
      await call(
        client,
        'instagram_execute_mock_auto_direct_reply',
        args
      )
    );

    assert.equal(duplicate.resultId, executed.resultId);
    assert.equal(duplicate.executedAt, executed.executedAt);

    console.log('PASS: Duplicate execution prevented.');

    // 10. Restart the actual MCP server.
    await client.close();
    client = null;

    client = await connect(env);

    const afterRestart = parseResponse(
      await call(
        client,
        'instagram_execute_mock_auto_direct_reply',
        args
      )
    );

    assert.equal(afterRestart.resultId, executed.resultId);
    assert.equal(
      afterRestart.executedAt,
      executed.executedAt
    );

    console.log('PASS: Receipt survives MCP restart.');
    console.log('PASS: No real Instagram DM was sent.');
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
