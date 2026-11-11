import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP growth draft preview is read-only and mock-labeled', {
  timeout: 20000
}, async () => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: { ...process.env, OFFLINE_MODE: 'true' }
  });

  const client = new Client(
    { name: 'growth-draft-preview-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();

    assert.ok(tools.length >= 26);

    const tool = tools.find(
      item => item.name === 'instagram_preview_growth_draft'
    );
    assert.ok(tool, 'Preview tool must be registered');

    const result = await client.callTool({
      name: 'instagram_preview_growth_draft',
      arguments: {
        accountId: 'demo-account-1',
        experimentId: 'repeat-top-content-pattern',
        type: 'reel'
      }
    });

    assert.notEqual(result.isError, true);

    const content = result.content.find(item => item.type === 'text');
    assert.ok(content);

    const preview = JSON.parse(content.text);

    assert.equal(preview.source, 'mock');
    assert.equal(preview.sourceAccountId, 'demo-account-1');
    assert.equal(preview.experimentId, 'repeat-top-content-pattern');
    assert.equal(preview.draft.type, 'reel');
    assert.equal(preview.requiresApproval, true);
    assert.equal(preview.saved, false);
    assert.ok(preview.draft.caption.includes('[Draft'));

    const invalid = await client.callTool({
      name: 'instagram_preview_growth_draft',
      arguments: {
        accountId: 'unknown-account',
        experimentId: 'repeat-top-content-pattern',
        type: 'reel'
      }
    });

    assert.equal(invalid.isError, true);

    console.log('PASS: MCP growth draft preview verified.');
  } finally {
    await client.close();
  }
});
