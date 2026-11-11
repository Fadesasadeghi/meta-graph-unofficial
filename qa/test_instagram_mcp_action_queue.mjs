import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function connect(ownerId, root) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/mcp/server.js'],
    env: {
      ...process.env,
      OFFLINE_MODE: 'true',
      INSTAGRAM_LOCAL_OWNER_ID: ownerId,
      INSTAGRAM_ACCOUNTS_DIR: join(root, 'accounts'),
      INSTAGRAM_ACTION_QUEUE_DIR: join(root, 'queue'),
      INSTAGRAM_ACTION_APPROVALS_DIR: join(root, 'approvals'),
      INSTAGRAM_ACTION_EXECUTIONS_DIR: join(root, 'executions')
    }
  });

  const client = new Client(
    { name: 'instagram-action-mcp-test', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  return client;
}

async function call(client, name, args) {
  const result = await client.callTool({
    name,
    arguments: args
  });

  const text = result.content.find(
    item => item.type === 'text'
  )?.text;

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  return { result, data };
}

test('MCP queues an Instagram story without executing it', {
  timeout: 30000
}, async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'mcp-action-queue-')
  );

  let clientA;
  let clientB;

  try {
    clientA = await connect('owner-a', root);

    const { tools } = await clientA.listTools();

    for (const name of [
      'instagram_queue_action',
      'instagram_list_pending_actions',
      'instagram_get_action_status'
    ]) {
      assert.ok(
        tools.some(tool => tool.name === name),
        `Missing tool: ${name}`
      );
    }

    console.log('PASS: Action tools discovered.');

    const registration = await call(
      clientA,
      'instagram_add_local_account',
      {
        username: 'story.demo.test',
        accountType: 'creator'
      }
    );

    assert.notEqual(registration.result.isError, true);
    const accountId = registration.data.account.id;

    const request = {
      accountId,
      idempotencyKey: 'mcp-story-001',
      action: {
        kind: 'publish',
        type: 'story',
        mediaUrl: 'https://example.com/story.jpg',
        caption: 'My first MCP story'
      }
    };

    const queued = await call(
      clientA,
      'instagram_queue_action',
      request
    );

    assert.notEqual(queued.result.isError, true);
    assert.equal(queued.data.status, 'pending_approval');
    assert.equal(queued.data.executed, false);

    const actionId = queued.data.id;
    assert.ok(actionId);

    console.log('PASS: Story queued without execution.');

    const pending = await call(
      clientA,
      'instagram_list_pending_actions',
      { accountId }
    );

    assert.notEqual(pending.result.isError, true);
    assert.equal(pending.data.actions.length, 1);
    assert.equal(pending.data.actions[0].id, actionId);
    assert.equal(
      pending.data.actions[0].approvalStatus,
      'pending'
    );

    console.log('PASS: Pending action listed.');

    const status = await call(
      clientA,
      'instagram_get_action_status',
      { accountId, actionId }
    );

    assert.notEqual(status.result.isError, true);
    assert.equal(status.data.approvalStatus, 'pending');
    assert.equal(status.data.executionStatus, 'not_checked');

    console.log('PASS: Action status verified.');

    const repeated = await call(
      clientA,
      'instagram_queue_action',
      request
    );

    assert.notEqual(repeated.result.isError, true);
    assert.equal(repeated.data.id, actionId);

    console.log('PASS: Duplicate request reused.');

    const conflict = await call(
      clientA,
      'instagram_queue_action',
      {
        ...request,
        action: {
          ...request.action,
          caption: 'Different caption'
        }
      }
    );

    assert.equal(conflict.result.isError, true);

    console.log('PASS: Conflicting duplicate rejected.');

    clientB = await connect('owner-b', root);

    const forbidden = await call(
      clientB,
      'instagram_list_pending_actions',
      { accountId }
    );

    assert.equal(forbidden.result.isError, true);

    console.log('PASS: Cross-owner access rejected.');

    let executionFiles = [];

    try {
      executionFiles = await readdir(
        join(root, 'executions')
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    assert.deepEqual(executionFiles, []);

    console.log('PASS: No action execution occurred.');
  } finally {
    await clientA?.close();
    await clientB?.close();

    await rm(root, {
      recursive: true,
      force: true
    });
  }
});
