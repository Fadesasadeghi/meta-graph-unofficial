import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function connect(ownerId, root) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      ...process.env,
      OFFLINE_MODE: 'true',
      INSTAGRAM_LOCAL_OWNER_ID: ownerId,
      INSTAGRAM_ACCOUNTS_DIR: join(root, 'accounts'),
      INSTAGRAM_EXPERIMENTS_DIR: join(root, 'experiments')
    }
  });

  const client = new Client(
    { name: 'adaptive-growth-test', version: '1.0.0' },
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

  const content = result.content.find(
    item => item.type === 'text'
  );

  let data = null;

  if (content) {
    try {
      data = JSON.parse(content.text);
    } catch {
      data = content.text;
    }
  }

  return { result, data };
}

test('adaptive MCP advice uses account history and enforces ownership', {
  timeout: 60000
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'adaptive-mcp-'));

  let clientA;
  let clientB;

  try {
    clientA = await connect('owner-a', root);

    const { tools } = await clientA.listTools();

    assert.ok(
      tools.some(tool =>
        tool.name === 'instagram_adaptive_growth_advice'
      )
    );

    assert.ok(tools.length >= 30, 'Expected at least 30 MCP tools');

    const registration = await call(
      clientA,
      'instagram_add_local_account',
      {
        username: 'adaptive.demo.a',
        accountType: 'creator'
      }
    );

    assert.notEqual(registration.result.isError, true);
    const accountId = registration.data.account.id;

    const initial = await call(
      clientA,
      'instagram_adaptive_growth_advice',
      { accountId }
    );

    assert.notEqual(initial.result.isError, true);
    assert.equal(initial.data.basedOnDemoTemplate, true);
    assert.equal(initial.data.templateSource, 'mock');
    assert.equal(initial.data.accountId, accountId);

    const initialRecommendation = initial.data.recommendations.find(
      item => item.experiment.id === 'repeat-top-content-pattern'
    );

    assert.ok(initialRecommendation);
    assert.equal(initialRecommendation.priority, 'needs_testing');
    assert.equal(initialRecommendation.completedTrials, 0);

    console.log('PASS: Initial recommendation needs testing.');

    for (let index = 0; index < 3; index++) {
      const created = await call(
        clientA,
        'instagram_create_growth_experiment',
        {
          accountId,
          adviceExperimentId: 'repeat-top-content-pattern',
          title: `Adaptive experiment ${index + 1}`,
          hypothesis: 'A content variation may improve engagement.',
          metric: 'engagement_rate',
          baseline: {
            value: 5,
            measuredAt: '2026-11-01T12:00:00Z',
            source: 'mock'
          }
        }
      );

      assert.notEqual(created.result.isError, true);

      const experimentId = created.data.id;

      const running = await call(
        clientA,
        'instagram_update_growth_experiment',
        {
          accountId,
          experimentId,
          status: 'running'
        }
      );

      assert.notEqual(running.result.isError, true);

      const completed = await call(
        clientA,
        'instagram_update_growth_experiment',
        {
          accountId,
          experimentId,
          status: 'completed',
          outcome: {
            value: 7 + index,
            measuredAt: '2026-11-08T12:00:00Z',
            source: 'mock'
          }
        }
      );

      assert.notEqual(completed.result.isError, true);
    }

    const updated = await call(
      clientA,
      'instagram_adaptive_growth_advice',
      { accountId }
    );

    assert.notEqual(updated.result.isError, true);

    const recommendation = updated.data.recommendations.find(
      item => item.experiment.id === 'repeat-top-content-pattern'
    );

    assert.ok(recommendation);
    assert.equal(recommendation.completedTrials, 3);
    assert.equal(recommendation.improvedTrials, 3);
    assert.equal(recommendation.priority, 'promising');

    console.log('PASS: Adaptive priority changed to promising.');

    clientB = await connect('owner-b', root);

    const forbidden = await call(
      clientB,
      'instagram_adaptive_growth_advice',
      { accountId }
    );

    assert.equal(forbidden.result.isError, true);

    console.log('PASS: Cross-owner access rejected.');
    console.log('PASS: Adaptive Growth Advisor MCP verified.');
  } finally {
    if (clientA) await clientA.close();
    if (clientB) await clientB.close();

    await rm(root, {
      recursive: true,
      force: true
    });
  }
});
