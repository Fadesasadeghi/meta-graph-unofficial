import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP Growth Advisor: discovery, advice and mock isolation', {
  timeout: 20000
}, async () => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: { ...process.env, OFFLINE_MODE: 'true' }
  });

  const client = new Client(
    { name: 'growth-advisor-mcp-test', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();

    assert.equal(tools.length, 25);

    const tool = tools.find(
      item => item.name === 'instagram_growth_advice'
    );

    assert.ok(tool, 'Growth Advisor tool must be registered');
    assert.deepEqual(
      tool.inputSchema.properties.accountId.enum,
      ['demo-account-1']
    );

    const result = await client.callTool({
      name: 'instagram_growth_advice',
      arguments: { accountId: 'demo-account-1' }
    });

    assert.notEqual(result.isError, true);

    const content = result.content.find(
      item => item.type === 'text'
    );

    assert.ok(content);

    const advice = JSON.parse(content.text);

    assert.equal(advice.source, 'mock');
    assert.equal(advice.accountId, 'demo-account-1');
    assert.equal(advice.experiments.length, 2);

    for (const experiment of advice.experiments) {
      assert.ok(experiment.hypothesis);
      assert.ok(experiment.evidence.length > 0);
      assert.ok(experiment.action);
      assert.ok(experiment.successMetrics.length > 0);
      assert.equal(experiment.confidence, 'low');
    }

    assert.ok(
      advice.warnings.some(
        warning => warning.includes('simulated data')
      )
    );

    const invalid = await client.callTool({
      name: 'instagram_growth_advice',
      arguments: { accountId: 'unknown-account' }
    });

    assert.equal(invalid.isError, true);

    console.log('PASS: Growth Advisor MCP integration verified.');
  } finally {
    await client.close();
  }
});
