import assert from 'node:assert/strict';
import test from 'node:test';
import { TwinTransport } from '../dist/twins/transport.js';

test('Instagram API request invokes shared limiter', async () => {
  const limiter = TwinTransport.getOutboundLimiter();
  const originalAcquire = limiter.acquire;
  let capturedKey = null;

  limiter.acquire = async (key) => {
    capturedKey = key;
    throw new Error('TEST_LIMITER_BLOCK');
  };

  try {
    const transport = new TwinTransport();

    await assert.rejects(
      transport.request('https://i.instagram.com/api/v1/users/info/', {
        accountKey: 'test-account'
      }),
      /TEST_LIMITER_BLOCK/
    );

    assert.equal(capturedKey, 'test-account');
  } finally {
    limiter.acquire = originalAcquire;
  }
});

test('unidentified Instagram requests use shared quota', async () => {
  const limiter = TwinTransport.getOutboundLimiter();
  const originalAcquire = limiter.acquire;
  let capturedKey = null;

  limiter.acquire = async (key) => {
    capturedKey = key;
    throw new Error('TEST_LIMITER_BLOCK');
  };

  try {
    const transport = new TwinTransport();

    await assert.rejects(
      transport.request('https://www.instagram.com/api/v1/test/'),
      /TEST_LIMITER_BLOCK/
    );

    assert.equal(capturedKey, 'shared-instagram');
  } finally {
    limiter.acquire = originalAcquire;
  }
});

test('unrelated domains bypass Instagram limiter', async () => {
  const limiter = TwinTransport.getOutboundLimiter();
  const originalAcquire = limiter.acquire;
  let called = false;

  limiter.acquire = async () => {
    called = true;
    throw new Error('TEST_LIMITER_BLOCK');
  };

  try {
    const transport = new TwinTransport();

    await assert.rejects(
      transport.request('https://127.0.0.1:1/', {
        timeoutMs: 1000
      })
    );

    assert.equal(called, false);
  } finally {
    limiter.acquire = originalAcquire;
  }
});
