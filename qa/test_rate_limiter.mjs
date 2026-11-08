import assert from 'node:assert/strict';
import test from 'node:test';
import { SmartRateLimiter } from '../dist/gateway/rate_limiter.js';

test('GET /insights is ACCOUNT', () => {
  const limiter = new SmartRateLimiter();
  assert.equal(
    limiter.classifyMode('GET', '/me/insights'),
    'ACCOUNT'
  );
});

test('POST requests are ACTION', () => {
  const limiter = new SmartRateLimiter();
  assert.equal(
    limiter.classifyMode('POST', '/media'),
    'ACTION'
  );
});

test('PUT requests must be ACTION', () => {
  const limiter = new SmartRateLimiter();
  assert.equal(
    limiter.classifyMode('PUT', '/media'),
    'ACTION'
  );
});

test('account burst limit rejects excess requests', () => {
  const limiter = new SmartRateLimiter({
    accountBurstLimit: 2,
    accountHourlyCap: 100
  });

  const first = limiter.check('GET', '/me');
  const second = limiter.check('GET', '/me');
  const third = limiter.check('GET', '/me');

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.reason, 'burst_limit_exceeded');
});

test('hourly cap must return remaining wait time', () => {
  const limiter = new SmartRateLimiter({
    accountBurstLimit: 10,
    accountHourlyCap: 2
  });

  limiter.check('GET', '/me');
  limiter.check('GET', '/me');

  const blocked = limiter.check('GET', '/me');

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'account_hourly_safety_cap');
  assert.ok(
    blocked.retryAfterSec >= 3500,
    `Expected remaining hourly wait, got ${blocked.retryAfterSec}s`
  );
});

test('rejected requests must not consume hourly quota', () => {
  const limiter = new SmartRateLimiter({
    accountBurstLimit: 1,
    accountHourlyCap: 2
  });

  limiter.check('GET', '/me');

  const blocked1 = limiter.check('GET', '/me');
  const blocked2 = limiter.check('GET', '/me');

  assert.equal(blocked1.reason, 'burst_limit_exceeded');
  assert.equal(blocked2.reason, 'burst_limit_exceeded');
});
