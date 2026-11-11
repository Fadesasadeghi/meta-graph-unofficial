import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4187;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(child) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) {
      throw new Error('Dashboard server exited unexpectedly.');
    }

    try {
      const response = await fetch(`${BASE}/api/health`);

      if (response.ok) return;
    } catch {}

    await sleep(100);
  }

  throw new Error('Dashboard server did not start.');
}

test('dashboard API is mock-only, safe and idempotent', async () => {
  const server = spawn(
    process.execPath,
    ['scripts/dashboard_server.mjs'],
    {
      env: {
        ...process.env,
        DASHBOARD_PORT: String(PORT)
      },
      stdio: 'ignore'
    }
  );

  try {
    await waitForServer(server);

    const health = await fetch(`${BASE}/api/health`);
    const healthData = await health.json();

    assert.equal(healthData.ok, true);
    assert.equal(healthData.mode, 'mock');

    const inbox = await fetch(`${BASE}/api/demo/inbox`);
    const inboxData = await inbox.json();

    assert.equal(inbox.status, 200);
    assert.equal(inboxData.source, 'mock');
    assert.equal(inboxData.items.length, 4);

    const comments = await fetch(`${BASE}/api/demo/comments`);
    const commentsData = await comments.json();

    assert.equal(comments.status, 200);
    assert.equal(commentsData.source, 'mock');
    assert.equal(commentsData.items.length, 1);

    const payload = JSON.stringify({
      confirm: true,
      messageId: 'demo-message-pricing-1'
    });

    const post = (origin = BASE, body = payload) =>
      fetch(`${BASE}/api/demo/execute-pricing`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json'
        },
        body
      });

    const invalidOrigin = await post('https://example.com');
    assert.equal(invalidOrigin.status, 403);

    const invalidMessage = await post(
      BASE,
      JSON.stringify({
        confirm: true,
        messageId: 'demo-message-order-1'
      })
    );
    assert.equal(invalidMessage.status, 400);

    const invalidConfirmation = await post(
      BASE,
      JSON.stringify({
        confirm: false,
        messageId: 'demo-message-pricing-1'
      })
    );
    assert.equal(invalidConfirmation.status, 400);

    // Cold concurrent requests before any receipt exists.
    const coldResponses = await Promise.all([
      post(),
      post()
    ]);

    const coldStatuses = coldResponses.map(response => response.status);

    assert.ok(coldStatuses.includes(200));
    assert.ok(
      coldStatuses.every(status => status === 200 || status === 409),
      `Unexpected cold concurrency statuses: ${coldStatuses}`
    );

    console.log('PASS: Cold concurrency:', coldStatuses.join(', '));

    // A retry after completion must return the completed receipt.
    const first = await post();
    const second = await post();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);

    const firstData = await first.json();
    const secondData = await second.json();

    assert.equal(firstData.source, 'mock');
    assert.equal(firstData.receipt.simulated, true);
    assert.equal(firstData.receipt.status, 'completed');

    assert.equal(
      firstData.receipt.resultId,
      secondData.receipt.resultId
    );

    // Concurrent retries after the receipt is completed.
    const retries = await Promise.all([
      post(),
      post(),
      post()
    ]);

    for (const response of retries) {
      assert.equal(response.status, 200);

      const result = await response.json();

      assert.equal(
        result.receipt.resultId,
        firstData.receipt.resultId
      );
    }

    const receipts = await fetch(`${BASE}/api/demo/executions`);
    const receiptsData = await receipts.json();

    assert.equal(receiptsData.source, 'mock');
    assert.equal(receiptsData.items.length, 1);

    assert.equal(
      receiptsData.items[0].resultId,
      firstData.receipt.resultId
    );

    console.log('PASS: Mock API endpoints verified.');
    console.log('PASS: Invalid requests rejected.');
    console.log('PASS: Completed receipt reused without duplicate execution.');
    console.log('PASS: One execution receipt recorded.');
    console.log('PASS: No live Instagram interaction.');
  } finally {
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await Promise.race([
        once(server, 'exit'),
        sleep(3000)
      ]);
    }
  }
});
