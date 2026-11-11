import test from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';

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

test('MCP reads mock Instagram comments safely', {
  timeout: 15000
}, async () => {
  const provider = new MockInstagramProvider();

  const mediaResult = await provider.listMedia(
    'demo-account-1'
  );

  assert.equal(mediaResult.ok, true);

  const mediaIds = mediaResult.data.items.map(
    item => item.id
  );

  assert.ok(mediaIds.length > 0);

  const mediaId = mediaIds[0];

  const expected = await provider.listComments(
    'demo-account-1',
    mediaId,
    { limit: 20 }
  );

  assert.equal(expected.ok, true);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/mcp/server.js'],
    env: {
      ...process.env,
      OFFLINE_MODE: 'true',
      INSTAGRAM_LOCAL_OWNER_ID: 'comment-test-owner'
    }
  });

  const client = new Client(
    {
      name: 'mock-comments-mcp-test',
      version: '1.0.0'
    },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();

    assert.ok(
      tools.some(
        tool => tool.name === 'instagram_list_mock_comments'
      )
    );

    console.log('PASS: Mock comment MCP tool discovered.');

    const response = await call(
      client,
      'instagram_list_mock_comments',
      {
        accountId: 'demo-account-1',
        mediaId,
        limit: 20
      }
    );

    assert.notEqual(response.result.isError, true);
    assert.equal(response.data.ok, true);
    assert.equal(response.data.source, 'mock');
    assert.equal(response.data.simulated, true);

    assert.deepEqual(
      response.data.data.items,
      expected.data.items
    );

    console.log('PASS: MCP returns expected mock comments.');

    const invalidAccount = await call(
      client,
      'instagram_list_mock_comments',
      {
        accountId: 'another-account',
        mediaId
      }
    );

    assert.equal(invalidAccount.result.isError, true);

    console.log('PASS: Non-demo account rejected.');

    const invalidLimit = await call(
      client,
      'instagram_list_mock_comments',
      {
        accountId: 'demo-account-1',
        mediaId,
        limit: -1
      }
    );

    assert.equal(invalidLimit.result.isError, true);

    console.log('PASS: Invalid pagination rejected.');

    const invalidMedia = await call(
      client,
      'instagram_list_mock_comments',
      {
        accountId: 'demo-account-1',
        mediaId: 'unknown-media-id'
      }
    );

    assert.notEqual(invalidMedia.result.isError, true);
    assert.equal(invalidMedia.data.ok, false);
    assert.equal(invalidMedia.data.source, 'mock');
    assert.equal(invalidMedia.data.error.code, 'NOT_FOUND');

    console.log('PASS: Unknown media returns NOT_FOUND.');

    console.log(`PASS: ${tools.length} MCP tools discovered.`);
  } finally {
    await client.close();
  }
});
