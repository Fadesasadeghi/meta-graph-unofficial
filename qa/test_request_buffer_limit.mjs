import assert from 'node:assert/strict';
import test from 'node:test';
import { TwinTransport } from '../dist/twins/transport.js';

test('requestBuffer checks Instagram limiter before network', async () => {
  const limiter = TwinTransport.getOutboundLimiter();
  const originalAcquire = limiter.acquire;
  const accountKey = 'test-buffer-account';
  let calls = 0;

  limiter.acquire = async (key) => {
    calls += 1;
    assert.equal(key, accountKey);
    throw new Error('TEST_BUFFER_BLOCKED');
  };

  try {
    const transport = new TwinTransport({ accountKey });

    await assert.rejects(
      transport.requestBuffer('https://i.instagram.com/api/v1/test/'),
      /TEST_BUFFER_BLOCKED/
    );

    assert.equal(calls, 1);
  } finally {
    limiter.acquire = originalAcquire;
  }
});

test('requestBuffer does not limit unrelated local HTTP requests', async () => {
  const limiter = TwinTransport.getOutboundLimiter();
  const originalAcquire = limiter.acquire;
  let calls = 0;

  limiter.acquire = async () => {
    calls += 1;
    throw new Error('UNEXPECTED_LIMITER_CALL');
  };

  try {
    const transport = new TwinTransport();

    await assert.rejects(
      transport.requestBuffer('http://127.0.0.1:1/test', {
        timeoutMs: 1000
      })
    );

    assert.equal(calls, 0);
  } finally {
    limiter.acquire = originalAcquire;
  }
});
