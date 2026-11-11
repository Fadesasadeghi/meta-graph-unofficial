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
    { name: 'experiment-mcp-test', version: '1.0.0' },
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

  const text = result.content.find(item => item.type === 'text')?.text;
  return { result, data: text ? JSON.parse(text) : null };
}

test('MCP experiment lifecycle and owner isolation', {
  timeout: 30000
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcp-experiments-'));
  let clientA;
  let clientB;

  try {
    clientA = await connect('owner-a', root);

    const { tools } = await clientA.listTools();

    for (const name of [
      'instagram_create_growth_experiment',
      'instagram_list_growth_experiments',
      'instagram_update_growth_experiment'
    ]) {
      assert.ok(tools.some(tool => tool.name === name));
    }

    const registration = await call(
      clientA,
      'instagram_add_local_account',
      {
        username: 'experiment.demo.a',
        accountType: 'creator'
      }
    );

    assert.notEqual(registration.result.isError, true);
    const accountId = registration.data.account.id;

    const created = await call(
      clientA,
      'instagram_create_growth_experiment',
      {
        accountId,
        adviceExperimentId: 'repeat-top-content-pattern',
        title: 'Improve reel engagement',
        hypothesis: 'A stronger opening may improve engagement.',
        metric: 'engagement_rate',
        baseline: {
          value: 5.5,
          measuredAt: '2026-11-01T12:00:00.000Z',
          source: 'mock'
        }
      }
    );

    assert.notEqual(created.result.isError, true);
    assert.equal(created.data.status, 'planned');

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
    assert.equal(running.data.record.status, 'running');

    const completed = await call(
      clientA,
      'instagram_update_growth_experiment',
      {
        accountId,
        experimentId,
        status: 'completed',
        outcome: {
          value: 7,
          measuredAt: '2026-11-08T12:00:00.000Z',
          source: 'mock'
        }
      }
    );

    assert.notEqual(completed.result.isError, true);
    assert.equal(completed.data.record.status, 'completed');
    assert.equal(completed.data.evaluation.conclusion, 'improved');
    assert.equal(completed.data.evaluation.relativeChangePct, 27.27);

    const listed = await call(
      clientA,
      'instagram_list_growth_experiments',
      { accountId }
    );

    assert.notEqual(listed.result.isError, true);
    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0].id, experimentId);
    assert.equal(listed.data[0].evaluation.conclusion, 'improved');

    console.log('PASS: Experiment lifecycle and persistence.');

    clientB = await connect('owner-b', root);

    const forbidden = await call(
      clientB,
      'instagram_list_growth_experiments',
      { accountId }
    );

    assert.equal(forbidden.result.isError, true);

    const forbiddenUpdate = await call(
      clientB,
      'instagram_update_growth_experiment',
      {
        accountId,
        experimentId,
        status: 'cancelled'
      }
    );

    assert.equal(forbiddenUpdate.result.isError, true);

    console.log('PASS: Cross-owner access rejected.');
    console.log('PASS: Experiment Tracker MCP integration verified.');
  } finally {
    if (clientA) await clientA.close();
    if (clientB) await clientB.close();
    await rm(root, { recursive: true, force: true });
  }
});
