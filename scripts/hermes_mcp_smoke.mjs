import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const client = new Client({
  name: 'hermes-instagram-smoke-client',
  version: '0.1.0'
});

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(projectRoot, 'dist/mcp/server.js')],
  cwd: projectRoot,
  env: {
    ...process.env,
    OFFLINE_MODE: 'true'
  }
});

try {
  await client.connect(transport);
  console.log('PASS: MCP connection established');

  const { tools } = await client.listTools();
  console.log('Available tools:', tools.map(tool => tool.name));

  const required = [
    'ghost_get_profile',
    'ghost_get_posts',
    'ghost_get_media_metrics',
    'ghost_get_comments',
    'ghost_search',
    'ghost_explore_viral',
    'ghost_audit_account'
  ];

  for (const name of required) {
    if (!tools.some(tool => tool.name === name)) {
      throw new Error(`Missing MCP tool: ${name}`);
    }
  }

  console.log('PASS: All 7 Ghost tools registered');

  const result = await client.callTool({
    name: 'ghost_get_profile',
    arguments: {}
  });

  if (!result.isError) {
    throw new Error(
      'Expected missing username to return a tool error'
    );
  }

  console.log('PASS: Invalid arguments rejected safely');
  console.log('PASS: Hermes MCP smoke test completed');
} catch (error) {
  console.error('FAIL:', error);
  process.exitCode = 1;
} finally {
  await client.close();
}
