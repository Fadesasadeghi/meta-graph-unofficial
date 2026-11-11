import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function withClient(directory, ownerId, callback) {
  const env = {
    ...process.env,
    INSTAGRAM_ACCOUNTS_DIR: directory
  };

  delete env.INSTAGRAM_LOCAL_OWNER_ID;

  if (ownerId !== null) {
    env.INSTAGRAM_LOCAL_OWNER_ID = ownerId;
  }

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env
  });

  const client = new Client(
    { name: 'account-integration-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    await callback(client);
  } finally {
    await client.close();
  }
}

function payload(result) {
  const item = result.content.find(item => item.type === 'text');
  assert.ok(item, 'Expected a text response.');
  return JSON.parse(item.text);
}

test('MCP local accounts: registration, isolation and missing owner', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'instagram-mcp-accounts-')
  );

  try {
    await withClient(directory, 'owner-a', async client => {
      const added = await client.callTool({
        name: 'instagram_add_local_account',
        arguments: {
          username: 'test.personal',
          accountType: 'personal'
        }
      });

      assert.notEqual(added.isError, true);

      const account = payload(added).account;
      assert.equal(account.username, 'test.personal');
      assert.equal(account.connectionStatus, 'local');

      const listed = await client.callTool({
        name: 'instagram_list_local_accounts',
        arguments: {}
      });

      assert.equal(payload(listed).total, 1);
    });

    await withClient(directory, 'owner-b', async client => {
      const listed = await client.callTool({
        name: 'instagram_list_local_accounts',
        arguments: {}
      });

      assert.equal(payload(listed).total, 0);
    });

    await withClient(directory, null, async client => {
      const listed = await client.callTool({
        name: 'instagram_list_local_accounts',
        arguments: {}
      });

      assert.equal(listed.isError, true);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
