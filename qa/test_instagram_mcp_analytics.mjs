import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP analytics: tool discovery, execution and mock isolation', {
  timeout: 20000
}, async () => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: { ...process.env, OFFLINE_MODE: 'true' }
  });

  const client = new Client(
    { name: 'analytics-mcp-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    assert.equal(tools.length, 24);

    const analyticsTool = tools.find(
      tool => tool.name === 'instagram_analyze_account'
    );
    assert.ok(analyticsTool);
    assert.deepEqual(
      analyticsTool.inputSchema.properties.accountId.enum,
      ['demo-account-1']
    );

    const result = await client.callTool({
      name: 'instagram_analyze_account',
      arguments: { accountId: 'demo-account-1' }
    });

    assert.notEqual(result.isError, true);

    const content = result.content.find(item => item.type === 'text');
    assert.ok(content);

    const report = JSON.parse(content.text);

    assert.equal(report.ok, true);
    assert.equal(report.source, 'mock');
    assert.equal(report.data.source, 'mock');
    assert.equal(report.data.username, 'demo.creator');
    assert.equal(report.data.analyzedPostCount, 3);
    assert.equal(report.data.averageEngagementRatePct, 8.23);

    const invalidResult = await client.callTool({
      name: 'instagram_analyze_account',
      arguments: { accountId: 'unknown-account' }
    });

    assert.equal(invalidResult.isError, true);

    console.log('PASS: MCP analytics and mock isolation verified.');
  } finally {
    await client.close();
  }
});
