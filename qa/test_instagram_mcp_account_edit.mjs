import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP account draft editing: update and isolation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-account-edit-'));

  const client = new Client(
    { name: 'account-edit-test', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      ...process.env,
      INSTAGRAM_LOCAL_OWNER_ID: 'edit-test-owner',
      INSTAGRAM_ACCOUNTS_DIR: join(directory, 'accounts'),
      INSTAGRAM_ACCOUNT_DRAFTS_DIR: join(directory, 'drafts')
    }
  });

  async function call(name, args = {}) {
    const result = await client.callTool({
      name,
      arguments: args
    });

    const item = result.content.find(x => x.type === 'text');
    assert.ok(item, `No text response: ${name}`);

    return {
      isError: result.isError === true,
      data: JSON.parse(item.text)
    };
  }

  try {
    await client.connect(transport);

    const tools = await client.listTools();

    assert.ok(
      tools.tools.some(t => t.name === 'instagram_update_account_draft')
    );

    const a = await call('instagram_add_local_account', {
      username: 'account.one',
      accountType: 'personal'
    });

    const b = await call('instagram_add_local_account', {
      username: 'account.two',
      accountType: 'creator'
    });

    assert.equal(a.isError, false);
    assert.equal(b.isError, false);

    const accountA = a.data.account.id;
    const accountB = b.data.account.id;

    const first = await call('instagram_create_account_draft', {
      accountId: accountA,
      type: 'post',
      caption: 'Original first'
    });

    const second = await call('instagram_create_account_draft', {
      accountId: accountB,
      type: 'post',
      caption: 'Original second'
    });

    assert.equal(first.isError, false);
    assert.equal(second.isError, false);

    const updated = await call('instagram_update_account_draft', {
      accountId: accountA,
      id: first.data.draft.id,
      caption: 'Updated first',
      hashtags: ['hermes', 'instagram']
    });

    assert.equal(updated.isError, false);
    assert.equal(updated.data.draft.caption, 'Updated first');
    assert.deepEqual(updated.data.draft.hashtags, ['hermes', 'instagram']);

    const listed = await call('instagram_list_account_drafts', {
      accountId: accountB
    });

    assert.equal(listed.data.drafts[0].caption, 'Original second');

    const denied = await call('instagram_update_account_draft', {
      accountId: accountB,
      id: first.data.draft.id,
      caption: 'Unauthorized change'
    });

    assert.equal(denied.isError, true);

    const invalid = await call('instagram_update_account_draft', {
      accountId: accountA,
      id: first.data.draft.id,
      caption: 'x'.repeat(2201)
    });

    assert.equal(invalid.isError, true);

    console.log('PASS: Account editing and isolation verified.');
  } finally {
    await client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
