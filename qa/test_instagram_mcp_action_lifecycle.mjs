import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { AccountStore } from '../dist/accounts/account_store.js';
import { ActionQueue } from '../dist/actions/action_queue.js';
import { ActionApprovalStore } from '../dist/actions/action_approval_store.js';
import { MockActionExecutor } from '../dist/actions/mock_action_executor.js';

async function connect(root) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/mcp/server.js'],
    env: {
      ...process.env,
      OFFLINE_MODE: 'true',
      INSTAGRAM_LOCAL_OWNER_ID: 'owner-a',
      INSTAGRAM_ACCOUNTS_DIR: join(root, 'accounts'),
      INSTAGRAM_ACTION_QUEUE_DIR: join(root, 'queue'),
      INSTAGRAM_ACTION_APPROVALS_DIR: join(root, 'approvals'),
      INSTAGRAM_ACTION_EXECUTIONS_DIR: join(root, 'executions')
    }
  });

  const client = new Client(
    { name: 'action-lifecycle-test', version: '1.0.0' },
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

  assert.notEqual(
    result.isError,
    true,
    `MCP error in ${name}: ${text}`
  );

  return JSON.parse(text);
}

test('MCP story to approval to mock execution', {
  timeout: 30000
}, async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'instagram-full-lifecycle-')
  );

  let client;

  try {
    client = await connect(root);

    const registered = await call(
      client,
      'instagram_add_local_account',
      {
        username: 'lifecycle.demo',
        accountType: 'creator'
      }
    );

    const accountId = registered.account.id;

    const queued = await call(
      client,
      'instagram_queue_action',
      {
        accountId,
        idempotencyKey: 'lifecycle-story-001',
        action: {
          kind: 'publish',
          type: 'story',
          mediaUrl: 'https://example.com/story.jpg',
          caption: 'My first approved story'
        }
      }
    );

    assert.equal(queued.status, 'pending_approval');
    assert.equal(queued.executed, false);

    console.log('PASS: Story queued through MCP.');

    const accounts = new AccountStore(
      join(root, 'accounts')
    );

    const queue = new ActionQueue(
      accounts,
      join(root, 'queue')
    );

    const approvals = new ActionApprovalStore(
      accounts,
      queue,
      join(root, 'approvals')
    );

    const executor = new MockActionExecutor(
      queue,
      approvals,
      join(root, 'executions')
    );

    await assert.rejects(
      executor.execute('owner-a', accountId, queued.id),
      /not approved/
    );

    console.log('PASS: Unapproved execution blocked.');

    const decision = await approvals.decide(
      'owner-a',
      accountId,
      queued.id,
      'approved'
    );

    assert.equal(decision.decision, 'approved');

    console.log('PASS: Approval recorded outside MCP.');

    const status = await call(
      client,
      'instagram_get_action_status',
      {
        accountId,
        actionId: queued.id
      }
    );

    assert.equal(status.approvalStatus, 'approved');

    console.log('PASS: MCP observes approval.');

    const first = await executor.execute(
      'owner-a',
      accountId,
      queued.id
    );

    assert.equal(first.status, 'completed');
    assert.equal(first.simulated, true);
    assert.ok(first.resultId.startsWith('mock-'));

    console.log('PASS: Story executed in MOCK mode.');

    const restartedExecutor = new MockActionExecutor(
      new ActionQueue(
        new AccountStore(join(root, 'accounts')),
        join(root, 'queue')
      ),
      new ActionApprovalStore(
        new AccountStore(join(root, 'accounts')),
        new ActionQueue(
          new AccountStore(join(root, 'accounts')),
          join(root, 'queue')
        ),
        join(root, 'approvals')
      ),
      join(root, 'executions')
    );

    const second = await restartedExecutor.execute(
      'owner-a',
      accountId,
      queued.id
    );

    assert.deepEqual(second, first);

    console.log('PASS: Restart does not duplicate execution.');

    const pending = await call(
      client,
      'instagram_list_pending_actions',
      { accountId }
    );

    assert.equal(pending.actions.length, 0);

    console.log('PASS: Approved action leaves pending list.');
    console.log('PASS: Full MOCK lifecycle verified.');
  } finally {
    await client?.close();

    await rm(root, {
      recursive: true,
      force: true
    });
  }
});
