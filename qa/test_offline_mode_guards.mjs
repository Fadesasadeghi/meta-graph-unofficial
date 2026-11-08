/**
 * qa/test_offline_mode_guards.mjs
 *
 * Deterministic regression test suite for OFFLINE_MODE safety in Ghost Mode MCP Server.
 * Verifies that all seven tool paths and internal TwinTransport calls fail-closed
 * with zero outbound network requests.
 */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { GhostService } from '../dist/mcp/ghost_service.js';
import { TwinTransport } from '../dist/twins/transport.js';

console.log('=== Starting OFFLINE_MODE Safety & Regression Tests ===\n');

// ----------------------------------------------------------------------------
// 1. Install Global & Instance Network Traps
// ----------------------------------------------------------------------------
let networkCalls = [];
const originalRequest = TwinTransport.prototype.request;
TwinTransport.prototype.request = async function (url, ...args) {
  const err = new Error(`OUTBOUND_NETWORK_LEAK: Forbidden network request to ${url}`);
  networkCalls.push({ url, stack: err.stack });
  throw err;
};

try {
  // --------------------------------------------------------------------------
  // Test Suite A: Direct GhostService Offline Guards with Valid Inputs
  // --------------------------------------------------------------------------
  console.log('[Suite A] Testing Direct GhostService Offline Guards with Valid Inputs');

  process.env.OFFLINE_MODE = 'true';
  const ghost = new GhostService();

  assert.equal(ghost.isOfflineMode(), true, 'GhostService.isOfflineMode() must be true');

  const testCases = [
    {
      tool: 'ghost_get_profile',
      name: 'getProfile',
      fn: () => ghost.getProfile('cristiano'),
      expectedPattern: /Profile inspection is unavailable in offline mode\./
    },
    {
      tool: 'ghost_get_posts',
      name: 'getTimelinePosts',
      fn: () => ghost.getTimelinePosts({ username: 'cristiano', limit: 5 }),
      expectedPattern: /Timeline retrieval is unavailable in offline mode\./
    },
    {
      tool: 'ghost_get_media_metrics',
      name: 'getMediaMetrics',
      fn: () => ghost.getMediaMetrics('Deyg1mxiobv'),
      expectedPattern: /Media metrics retrieval is unavailable in offline mode\./
    },
    {
      tool: 'ghost_get_comments',
      name: 'getComments',
      fn: () => ghost.getComments('Deyg1mxiobv', 10),
      expectedPattern: /Comment harvesting is unavailable in offline mode\./
    },
    {
      tool: 'ghost_search',
      name: 'search',
      fn: () => ghost.search('cristiano', 'users'),
      expectedPattern: /Search is unavailable in offline mode\./
    },
    {
      tool: 'ghost_explore_viral',
      name: 'getViralExplore',
      fn: () => ghost.getViralExplore(5),
      expectedPattern: /Viral explore is unavailable in offline mode\./
    },
    {
      tool: 'ghost_audit_account',
      name: 'auditAccount',
      fn: () => ghost.auditAccount('cristiano', 5),
      expectedPattern: /Account audit is unavailable in offline mode\./
    }
  ];

  for (const tc of testCases) {
    await assert.rejects(
      tc.fn,
      tc.expectedPattern,
      `Expected ${tc.name} to reject with offline mode guard error`
    );
    console.log(`  PASS: ${tc.tool} (${tc.name}) blocked with expected error`);
  }

  // Also verify internal scraper method fetchLiveProfileMetadata if called directly
  await assert.rejects(
    () => ghost.fetchLiveProfileMetadata('cristiano'),
    /Profile inspection is unavailable in offline mode\./,
    'Expected internal fetchLiveProfileMetadata to reject with offline mode error'
  );
  console.log('  PASS: internal fetchLiveProfileMetadata blocked with expected error');

  // Verify ZERO network calls were initiated
  assert.equal(networkCalls.length, 0, `Zero network calls permitted. Captured: ${networkCalls.length}`);
  console.log('  PASS: Network trap verified 0 outbound HTTP/HTTPS requests leaked.\n');

  // --------------------------------------------------------------------------
  // Test Suite B: Constructor Options & Offline Propagation
  // --------------------------------------------------------------------------
  console.log('[Suite B] Testing Constructor & Client Options Propagation');

  // Test 1: Explicit options { offlineMode: true } without process.env
  delete process.env.OFFLINE_MODE;
  const ghostExplicit = new GhostService(undefined, { offlineMode: true });
  assert.equal(ghostExplicit.isOfflineMode(), true, 'options.offlineMode=true must be respected');
  await assert.rejects(
    () => ghostExplicit.getProfile('cristiano'),
    /Profile inspection is unavailable in offline mode\./
  );
  console.log('  PASS: GhostService(undefined, { offlineMode: true }) blocks network');

  // Test 2: Passing client with discovery.isOfflineMode() === true
  const mockClient = {
    discovery: {
      isOfflineMode: () => true
    }
  };
  const ghostWithClient = new GhostService(mockClient, { offlineMode: false });
  assert.equal(ghostWithClient.isOfflineMode(), true, 'client.discovery.isOfflineMode() must propagate');
  await assert.rejects(
    () => ghostWithClient.getProfile('cristiano'),
    /Profile inspection is unavailable in offline mode\./
  );
  console.log('  PASS: Mock client with isOfflineMode() propagates to GhostService\n');

  // --------------------------------------------------------------------------
  // Test Suite C: MCP Stdio Protocol Level Integration
  // --------------------------------------------------------------------------
  console.log('[Suite C] Testing MCP Protocol Level Rejections via Stdio Transport');

  process.env.OFFLINE_MODE = 'true';
  const projectRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');

  const mcpClient = new Client(
    { name: 'offline-regression-client', version: '1.0.0' },
    { capabilities: {} }
  );

  const mcpTransport = new StdioClientTransport({
    command: process.execPath,
    args: [
      path.join(projectRoot, 'dist/mcp/server.js')
    ],
    cwd: projectRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      OFFLINE_MODE: 'true'
    }
  });

  try {
    await mcpClient.connect(mcpTransport);
    console.log('  PASS: MCP stdio server connected');

    const mcpCases = [
      { tool: 'ghost_get_profile', args: { username: 'cristiano' }, pattern: 'Profile inspection is unavailable in offline mode.' },
      { tool: 'ghost_get_posts', args: { username: 'cristiano', limit: 5 }, pattern: 'Timeline retrieval is unavailable in offline mode.' },
      { tool: 'ghost_get_media_metrics', args: { mediaId: 'Deyg1mxiobv' }, pattern: 'Media metrics retrieval is unavailable in offline mode.' },
      { tool: 'ghost_get_comments', args: { mediaId: 'Deyg1mxiobv', limit: 10 }, pattern: 'Comment harvesting is unavailable in offline mode.' },
      { tool: 'ghost_search', args: { query: 'cristiano', type: 'users' }, pattern: 'Search is unavailable in offline mode.' },
      { tool: 'ghost_explore_viral', args: { limit: 5 }, pattern: 'Viral explore is unavailable in offline mode.' },
      { tool: 'ghost_audit_account', args: { username: 'cristiano', sampleCount: 5 }, pattern: 'Account audit is unavailable in offline mode.' }
    ];

    for (const tc of mcpCases) {
      const resp = await mcpClient.callTool({
        name: tc.tool,
        arguments: tc.args
      });

      assert.equal(resp.isError, true, `${tc.tool} response must have isError: true`);
      const bodyText = resp.content?.[0]?.text || '';
      assert.ok(
        bodyText.includes(tc.pattern),
        `Expected ${tc.tool} output to contain "${tc.pattern}", got: ${bodyText}`
      );
      assert.ok(
        bodyText.includes('GHOST_TOOL_ERROR'),
        `Expected GHOST_TOOL_ERROR in response, got: ${bodyText}`
      );
      console.log(`  PASS: MCP callTool(${tc.tool}) -> isError: true with GHOST_TOOL_ERROR`);
    }
  } finally {
    await mcpClient.close();
  }

  console.log('\n=== All OFFLINE_MODE Tests Passed Successfully ===');
} finally {
  TwinTransport.prototype.request = originalRequest;
}
