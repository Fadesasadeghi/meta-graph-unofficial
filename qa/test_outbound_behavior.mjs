import assert from 'node:assert/strict';
import test from 'node:test';
import { OutboundLimiter } from '../dist/twins/outbound_limiter.js';

test('concurrent requests respect hourly cap', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 2,
    minIntervalMs: 0
  });

  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      limiter.acquire('test-account')
    )
  );

  assert.equal(
    results.filter(r => r.status === 'fulfilled').length,
    2
  );

  assert.equal(
    results.filter(r => r.status === 'rejected').length,
    3
  );
});

test('accounts have independent quotas', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 1,
    minIntervalMs: 0
  });

  await limiter.acquire('account-A');
  await limiter.acquire('account-B');

  await assert.rejects(
    limiter.acquire('account-A'),
    /hourly/i
  );
});

test('429 response activates cooldown', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 10,
    minIntervalMs: 0
  });

  limiter.recordResponse('test-account', 429, {
    'retry-after': '60'
  });

  await assert.rejects(
    limiter.acquire('test-account'),
    /cooldown/i
  );
});

test('successful response does not activate cooldown', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 10,
    minIntervalMs: 0
  });

  limiter.recordResponse('test-account', 200, {});

  await assert.doesNotReject(
    limiter.acquire('test-account')
  );
});
