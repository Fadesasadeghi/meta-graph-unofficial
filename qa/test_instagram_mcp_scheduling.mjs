import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Instagram MCP scheduling lifecycle', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'instagram-mcp-test-'));

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
    env: {
      ...process.env,
      INSTAGRAM_DRAFT_DIR: join(directory, 'drafts'),
      INSTAGRAM_TIMEZONE_FILE: join(directory, 'timezone.json')
    }
  });

  const client = new Client({
    name: 'instagram-integration-test',
    version: '1.0.0'
  });

  async function call(name, args = {}) {
    const result = await client.callTool({
      name,
      arguments: args
    });

    return {
      isError: result.isError === true,
      data: JSON.parse(result.content[0].text)
    };
  }

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = new Set(tools.tools.map(tool => tool.name));

    for (const name of [
      'instagram_create_draft',
      'instagram_list_drafts',
      'instagram_schedule_draft',
      'instagram_cancel_schedule',
      'instagram_get_timezone',
      'instagram_set_timezone'
    ]) {
      assert.ok(toolNames.has(name), `Missing MCP tool: ${name}`);
    }

    const created = await call('instagram_create_draft', {
      type: 'post',
      caption: 'MCP integration test'
    });

    assert.equal(created.isError, false);
    const id = created.data.draft.id;

    const blocked = await call('instagram_schedule_draft', {
      id,
      localDateTime: '2027-11-15T20:00'
    });

    assert.equal(blocked.isError, true);
    assert.match(blocked.data.error.message, /not confirmed/);

    const configured = await call('instagram_set_timezone', {
      timezone: 'Asia/Tehran'
    });

    assert.equal(configured.isError, false);
    assert.equal(configured.data.settings.confirmed, true);

    const scheduled = await call('instagram_schedule_draft', {
      id,
      localDateTime: '2027-11-15T20:00'
    });

    assert.equal(scheduled.isError, false);
    assert.equal(scheduled.data.draft.status, 'scheduled');
    assert.equal(
      scheduled.data.draft.scheduledAt,
      '2027-11-15T16:30:00.000Z'
    );

    const listed = await call('instagram_list_drafts');
    assert.equal(listed.isError, false);
    assert.ok(listed.data.drafts.some(
      draft => draft.id === id && draft.status === 'scheduled'
    ));

    const cancelled = await call('instagram_cancel_schedule', { id });

    assert.equal(cancelled.isError, false);
    assert.equal(cancelled.data.draft.status, 'draft');

  } finally {
    await client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
