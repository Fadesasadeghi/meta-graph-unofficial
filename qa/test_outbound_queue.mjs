import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { OutboundLimiter } from '../dist/twins/outbound_limiter.js';

test('requests for one account are spaced apart', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 10,
    minIntervalMs: 80
  });

  const start = performance.now();

  const completed = await Promise.all(
    Array.from({ length: 3 }, async () => {
      await limiter.acquire('account-A');
      return performance.now() - start;
    })
  );

  assert.ok(completed[1] >= 60);
  assert.ok(completed[2] >= 140);
});

test('different accounts do not share waiting queues', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 10,
    minIntervalMs: 200
  });

  await limiter.acquire('account-A');

  const start = performance.now();
  await limiter.acquire('account-B');

  assert.ok(performance.now() - start < 150);
});

test('hourly quota still rejects excess queued requests', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 2,
    minIntervalMs: 30
  });

  const results = await Promise.allSettled([
    limiter.acquire('account-A'),
    limiter.acquire('account-A'),
    limiter.acquire('account-A')
  ]);

  assert.equal(
    results.filter(result => result.status === 'fulfilled').length,
    2
  );

  assert.equal(
    results.filter(result => result.status === 'rejected').length,
    1
  );
});

test('429 during queue wait cancels request without consuming quota', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 2,
    minIntervalMs: 100
  });

  await limiter.acquire('account-A');

  const pending = limiter.acquire('account-A');

  limiter.recordResponse('account-A', 429, {
    'retry-after': '1'
  });

  await assert.rejects(pending, /cooldown/i);

  // After cooldown, the second request must still have quota available.
  await new Promise(resolve => setTimeout(resolve, 1050));

  await assert.doesNotReject(
    limiter.acquire('account-A')
  );

  await assert.rejects(
    limiter.acquire('account-A'),
    /hourly/i
  );
});

test('queue rejects requests exceeding maximum wait', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 10,
    minIntervalMs: 200,
    maxQueueWaitMs: 50
  });

  await limiter.acquire('account-A');

  await assert.rejects(
    limiter.acquire('account-A'),
    /queue wait exceeds maximum/i
  );
});

test('rejected queue request does not consume hourly quota', async () => {
  const limiter = new OutboundLimiter({
    hourlyCap: 2,
    minIntervalMs: 150,
    maxQueueWaitMs: 20
  });

  await limiter.acquire('account-A');

  await assert.rejects(
    limiter.acquire('account-A'),
    /queue wait exceeds maximum/i
  );

  await new Promise(resolve => setTimeout(resolve, 170));

  await assert.doesNotReject(
    limiter.acquire('account-A')
  );

  await assert.rejects(
    limiter.acquire('account-A'),
    /hourly/i
  );
});
