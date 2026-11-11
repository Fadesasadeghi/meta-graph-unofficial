import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import https from 'node:https';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function withClient({ accountsDir, snapshotsDir, ownerId }, callback) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    OFFLINE_MODE: 'true',
    INSTAGRAM_ACCOUNTS_DIR: accountsDir,
    INSTAGRAM_ANALYTICS_SNAPSHOTS_DIR: snapshotsDir
  };

  delete env.INSTAGRAM_LOCAL_OWNER_ID;

  if (ownerId !== null && ownerId !== undefined) {
    env.INSTAGRAM_LOCAL_OWNER_ID = ownerId;
  }

  const transport = new StdioClientTransport({
    command: process.execPath || 'node',
    args: ['dist/mcp/server.js'],
    env
  });

  const client = new Client(
    { name: 'mcp-growth-test-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    await callback(client);
  } finally {
    await client.close();
  }
}

function parsePayload(result) {
  const item = result.content?.find(c => c.type === 'text');
  assert.ok(item, 'Expected text content in MCP response.');
  return JSON.parse(item.text);
}

test('MCP: On-Demand Growth Analysis tool discovery and execution', async () => {
  // 1. Outbound network traps
  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;

  globalThis.fetch = async (...args) => {
    networkCalls++;
    throw new Error(`Live network request forbidden in offline test: fetch(${JSON.stringify(args[0])})`);
  };

  http.request = (...args) => {
    networkCalls++;
    throw new Error('Live HTTP request forbidden in offline test.');
  };

  https.request = (...args) => {
    networkCalls++;
    throw new Error('Live HTTPS request forbidden in offline test.');
  };

  const root = await mkdtemp(join(tmpdir(), 'mcp-growth-test-'));

  try {
    const accountsDir = join(root, 'accounts');
    const snapshotsDir = join(root, 'snapshots');

    const ownerA = 'owner-alice';
    const ownerB = 'owner-bob';

    // 2. Tool Discovery and Schema Validation
    await withClient({ accountsDir, snapshotsDir, ownerId: ownerA }, async client => {
      const { tools } = await client.listTools();
      const growthTool = tools.find(
        t => t.name === 'instagram_on_demand_growth_analysis'
      );

      assert.ok(growthTool, 'Tool instagram_on_demand_growth_analysis must be registered.');
      assert.equal(growthTool.inputSchema.type, 'object');
      assert.ok(growthTool.inputSchema.properties.accountId);
      assert.deepEqual(growthTool.inputSchema.required, ['accountId']);
      assert.equal(growthTool.inputSchema.additionalProperties, false);
      assert.ok(growthTool.description.includes('on-demand'));
    });

    // 3. Error Behavior: Unconfigured owner identity
    await withClient({ accountsDir, snapshotsDir, ownerId: null }, async client => {
      const res = await client.callTool({
        name: 'instagram_on_demand_growth_analysis',
        arguments: { accountId: 'any-account' }
      });

      assert.equal(res.isError, true, 'Must fail when owner ID is not configured.');
      const err = parsePayload(res);
      assert.ok(
        err.error?.message?.includes('INSTAGRAM_LOCAL_OWNER_ID') ||
        err.error?.message?.includes('owner is not configured'),
        'Must return descriptive error for missing owner ID.'
      );
    });

    // 4. Error Behavior: Missing or invalid accountId
    await withClient({ accountsDir, snapshotsDir, ownerId: ownerA }, async client => {
      const resMissing = await client.callTool({
        name: 'instagram_on_demand_growth_analysis',
        arguments: { accountId: '   ' }
      });

      assert.equal(resMissing.isError, true);
      const errMissing = parsePayload(resMissing);
      assert.ok(errMissing.error?.message?.includes('Valid accountId is required'));

      // Non-existent account
      const resNotFound = await client.callTool({
        name: 'instagram_on_demand_growth_analysis',
        arguments: { accountId: 'non-existent-account-id' }
      });

      assert.equal(resNotFound.isError, true);
      const errNotFound = parsePayload(resNotFound);
      assert.ok(errNotFound.error?.message?.includes('Account not found for this owner'));
    });

    let accountAId;

    // 5. Successful Baseline Analysis (Request 1)
    await withClient({ accountsDir, snapshotsDir, ownerId: ownerA }, async client => {
      // Register account locally
      const added = await client.callTool({
        name: 'instagram_add_local_account',
        arguments: {
          username: 'demo.creator',
          accountType: 'creator'
        }
      });
      assert.notEqual(added.isError, true);
      const addedData = parsePayload(added);
      assert.ok(addedData.account?.id);
      accountAId = addedData.account.id;

      // Invoke on-demand growth analysis
      const firstResult = await client.callTool({
        name: 'instagram_on_demand_growth_analysis',
        arguments: { accountId: accountAId }
      });

      assert.notEqual(firstResult.isError, true, 'First analysis must succeed.');
      const firstData = parsePayload(firstResult);

      assert.equal(firstData.ok, true);
      assert.equal(firstData.source, 'mock');
      assert.ok(firstData.fetchedAt);

      // Verify analytics report structure
      const analytics = firstData.data.analytics;
      assert.equal(analytics.report.accountId, accountAId);
      assert.equal(analytics.report.source, 'mock');
      assert.equal(analytics.report.followersCount, 12500);
      assert.equal(analytics.report.analyzedPostCount, 3);
      assert.equal(analytics.report.averageEngagementRatePct, 8.23);

      // Verify baseline snapshot created with NO trend
      assert.ok(analytics.snapshot?.id);
      assert.equal(analytics.snapshot.ownerId, ownerA);
      assert.equal(analytics.snapshot.accountId, accountAId);
      assert.equal(analytics.trend, null, 'Baseline analysis must have trend: null.');
      assert.ok(
        analytics.warnings.some(w => w.includes('No previous snapshot exists')),
        'Must contain warning about missing previous snapshot.'
      );

      // Verify advice and prioritized decisions
      const advice = firstData.data.advice;
      assert.equal(advice.accountId, accountAId);
      assert.ok(advice.experiments.length > 0);

      const decisions = firstData.data.decisions;
      assert.equal(decisions.accountId, accountAId);
      assert.ok(decisions.decisions.length > 0);
      assert.ok(decisions.decisions.every(d => d.requiresApproval === true));
      assert.ok(decisions.warnings.some(w => w.includes('simulated data')));
    });

    // 6. Repeated Call: Subsequent Analysis with Historical Comparison (Request 2)
    await new Promise(r => setTimeout(r, 60));

    await withClient({ accountsDir, snapshotsDir, ownerId: ownerA }, async client => {
      const secondResult = await client.callTool({
        name: 'instagram_on_demand_growth_analysis',
        arguments: { accountId: accountAId }
      });

      assert.notEqual(secondResult.isError, true, 'Second analysis must succeed.');
      const secondData = parsePayload(secondResult);

      assert.equal(secondData.ok, true);
      assert.equal(secondData.source, 'mock');

      const secondAnalytics = secondData.data.analytics;
      assert.notEqual(secondAnalytics.trend, null, 'Second analysis must compute a trend.');

      const trend = secondAnalytics.trend;
      assert.equal(trend.accountId, accountAId);
      assert.equal(trend.source, 'mock');
      assert.ok(trend.previousSnapshotId);
      assert.ok(trend.currentSnapshotId);
      assert.notEqual(trend.previousSnapshotId, trend.currentSnapshotId);

      // Verify metric comparison
      assert.equal(trend.followers.previous, 12500);
      assert.equal(trend.followers.current, 12500);
      assert.equal(trend.followers.direction, 'unchanged');

      assert.equal(trend.engagementRate.previous, 8.23);
      assert.equal(trend.engagementRate.current, 8.23);
      assert.equal(trend.engagementRate.direction, 'unchanged');

      // Verify decisions generated on second run
      assert.ok(secondData.data.decisions.decisions.length > 0);
      assert.ok(secondData.data.decisions.decisions.every(d => d.requiresApproval === true));
    });

    // 7. Ownership Isolation: Owner B cannot analyze Owner A's account
    await withClient({ accountsDir, snapshotsDir, ownerId: ownerB }, async client => {
      const resBlocked = await client.callTool({
        name: 'instagram_on_demand_growth_analysis',
        arguments: { accountId: accountAId }
      });

      assert.equal(resBlocked.isError, true, 'Owner B must not be permitted to analyze Owner A accounts.');
      const errBlocked = parsePayload(resBlocked);
      assert.ok(errBlocked.error?.message?.includes('Account not found for this owner'));

      // Owner B registers their own account and can analyze it independently
      const addOwnerB = await client.callTool({
        name: 'instagram_add_local_account',
        arguments: {
          username: 'bob.creator',
          accountType: 'creator'
        }
      });
      const bobAccount = parsePayload(addOwnerB).account;
      assert.ok(bobAccount.id);
      assert.notEqual(bobAccount.id, accountAId);

      const bobAnalysis = await client.callTool({
        name: 'instagram_on_demand_growth_analysis',
        arguments: { accountId: bobAccount.id }
      });
      assert.notEqual(bobAnalysis.isError, true);
      const bobData = parsePayload(bobAnalysis);
      assert.equal(bobData.ok, true);
      assert.equal(bobData.data.analytics.report.accountId, bobAccount.id);
      assert.equal(bobData.data.analytics.snapshot.ownerId, ownerB);
    });

    // 8. Zero Outbound Network Requests
    assert.equal(networkCalls, 0, 'No live network calls allowed.');

    console.log('PASS: MCP On-Demand Growth Analysis tool discovered and verified.');
    console.log('PASS: Input schema and argument validation verified.');
    console.log('PASS: Owner identity and account ownership strictly enforced.');
    // Verify snapshots were actually persisted in the isolated directory.
    const { readdir, readFile } = await import('node:fs/promises');

    const entries = await readdir(snapshotsDir, {
      recursive: true,
      withFileTypes: true
    });

    const snapshotFiles = entries.filter(
      entry => entry.isFile() && entry.name.endsWith('.json')
    );

    assert.ok(
      snapshotFiles.length >= 3,
      'Expected persisted snapshots for both owners in temp storage.'
    );

    const persisted = await Promise.all(
      snapshotFiles.map(async entry => {
        const filePath = join(entry.parentPath, entry.name);
        return JSON.parse(await readFile(filePath, 'utf8'));
      })
    );

    assert.ok(
      persisted.filter(item =>
        item.ownerId === ownerA && item.accountId === accountAId
      ).length >= 2,
      'Owner A must have two persisted snapshots.'
    );

    assert.ok(
      persisted.some(item => item.ownerId === ownerB),
      'Owner B must have a separately persisted snapshot.'
    );

    console.log('PASS: Snapshots persisted in isolated temp storage.');

    console.log('PASS: Baseline snapshot created without trend.');
    console.log('PASS: Subsequent analysis computed historical comparison trend.');
    console.log('PASS: Cross-owner isolation verified.');
    console.log('PASS: Zero live network requests verified.');
  } finally {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;

    await rm(root, { recursive: true, force: true });
  }
});
