import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function withClient(directory, ownerId, fn) {
  const env = {
    ...process.env,
    INSTAGRAM_ACCOUNTS_DIR: join(directory, 'accounts'),
    INSTAGRAM_ACCOUNT_DRAFTS_DIR: join(directory, 'drafts'),
    INSTAGRAM_LOCAL_OWNER_ID: ownerId
  };

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env
  });

  const client = new Client(
    { name: 'account-drafts-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function call(client, name, args = {}) {
  const result = await client.callTool({
    name,
    arguments: args
  });

  const item = result.content.find(item => item.type === 'text');
  assert.ok(item, `Missing text response from ${name}`);

  return {
    isError: result.isError === true,
    data: JSON.parse(item.text)
  };
}

test('MCP account drafts: registration, isolation and ownership', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'mcp-account-drafts-')
  );

  try {
    await withClient(directory, 'owner-a', async client => {
      const tools = await client.listTools();
      const names = new Set(tools.tools.map(tool => tool.name));

      for (const name of [
        'instagram_add_local_account',
        'instagram_create_account_draft',
        'instagram_list_account_drafts'
      ]) {
        assert.ok(names.has(name), `Missing tool: ${name}`);
      }

      const first = await call(client, 'instagram_add_local_account', {
        username: 'personal.test',
        accountType: 'personal'
      });

      const second = await call(client, 'instagram_add_local_account', {
        username: 'creator.test',
        accountType: 'creator'
      });

      assert.equal(first.isError, false);
      assert.equal(second.isError, false);

      const accountA = first.data.account.id;
      const accountB = second.data.account.id;

      const created = await call(client, 'instagram_create_account_draft', {
        accountId: accountA,
        type: 'post',
        caption: 'First account only'
      });

      assert.equal(created.isError, false);
      assert.equal(created.data.draft.status, 'draft');

      const listedA = await call(client, 'instagram_list_account_drafts', {
        accountId: accountA
      });

      const listedB = await call(client, 'instagram_list_account_drafts', {
        accountId: accountB
      });

      assert.equal(listedA.isError, false);
      assert.equal(listedB.isError, false);
      assert.equal(listedA.data.total, 1);
      assert.equal(listedB.data.total, 0);

      console.log('PASS: Drafts are isolated between accounts.');

      await withClient(directory, 'owner-b', async otherClient => {
        const denied = await call(
          otherClient,
          'instagram_list_account_drafts',
          { accountId: accountA }
        );

        assert.equal(denied.isError, true);
        assert.match(
          denied.data.error.message,
          /Account not found/
        );

        console.log('PASS: Cross-owner access rejected.');
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
