import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP account scheduling: timezone, isolation and cancellation', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'mcp-account-scheduling-')
  );

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      ...process.env,
      INSTAGRAM_LOCAL_OWNER_ID: 'test-owner',
      INSTAGRAM_ACCOUNTS_DIR: join(directory, 'accounts'),
      INSTAGRAM_ACCOUNT_DRAFTS_DIR: join(directory, 'drafts'),
      INSTAGRAM_OWNER_SETTINGS_DIR: join(directory, 'settings')
    }
  });

  const client = new Client(
    { name: 'account-scheduling-test', version: '1.0.0' },
    { capabilities: {} }
  );

  async function call(name, args = {}) {
    const result = await client.callTool({
      name,
      arguments: args
    });

    const item = result.content.find(item => item.type === 'text');
    assert.ok(item, `Missing response from ${name}`);

    return {
      isError: result.isError === true,
      data: JSON.parse(item.text)
    };
  }

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const names = new Set(tools.tools.map(tool => tool.name));

    for (const name of [
      'instagram_get_owner_timezone',
      'instagram_set_owner_timezone',
      'instagram_schedule_account_draft',
      'instagram_cancel_account_schedule'
    ]) {
      assert.ok(names.has(name), `Missing tool: ${name}`);
    }

    const first = await call('instagram_add_local_account', {
      username: 'test.personal',
      accountType: 'personal'
    });

    const second = await call('instagram_add_local_account', {
      username: 'test.creator',
      accountType: 'creator'
    });

    assert.equal(first.isError, false);
    assert.equal(second.isError, false);

    const accountA = first.data.account.id;
    const accountB = second.data.account.id;

    const created = await call('instagram_create_account_draft', {
      accountId: accountA,
      type: 'post',
      caption: 'Scheduled account draft'
    });

    assert.equal(created.isError, false);
    const draftId = created.data.draft.id;

    const blocked = await call('instagram_schedule_account_draft', {
      accountId: accountA,
      id: draftId,
      localDateTime: '2027-11-15T20:00'
    });

    assert.equal(blocked.isError, true);
    assert.match(blocked.data.error.message, /not confirmed/);

    const configured = await call('instagram_set_owner_timezone', {
      timezone: 'Asia/Tehran'
    });

    assert.equal(configured.isError, false);

    const scheduled = await call('instagram_schedule_account_draft', {
      accountId: accountA,
      id: draftId,
      localDateTime: '2027-11-15T20:00'
    });

    assert.equal(scheduled.isError, false);
    assert.equal(scheduled.data.draft.status, 'scheduled');
    assert.equal(
      scheduled.data.draft.scheduledAt,
      '2027-11-15T16:30:00.000Z'
    );

    const denied = await call('instagram_schedule_account_draft', {
      accountId: accountB,
      id: draftId,
      localDateTime: '2027-11-15T20:00'
    });

    assert.equal(denied.isError, true);

    const cancelled = await call('instagram_cancel_account_schedule', {
      accountId: accountA,
      id: draftId
    });

    assert.equal(cancelled.isError, false);
    assert.equal(cancelled.data.draft.status, 'draft');
    assert.equal(cancelled.data.draft.scheduledAt, undefined);

    console.log('PASS: Account timezone confirmation enforced.');
    console.log('PASS: Account-specific scheduling works.');
    console.log('PASS: Cross-account scheduling rejected.');
    console.log('PASS: Scheduling cancellation works.');
  } finally {
    await client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
