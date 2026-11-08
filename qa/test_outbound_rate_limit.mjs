import assert from 'node:assert/strict';
import test from 'node:test';
import { TwinTransport } from '../dist/twins/transport.js';

test('TwinTransport exposes request methods', () => {
  const transport = new TwinTransport();

  assert.equal(typeof transport.request, 'function');
  assert.equal(typeof transport.requestBuffer, 'function');
  assert.equal(typeof transport.downloadToFile, 'function');
});

test('TwinTransport provides shared outbound limiter', () => {
  assert.equal(
    typeof TwinTransport.getOutboundLimiter,
    'function',
    'Expected a shared outbound limiter'
  );
});

test('outbound limiter supports concurrency-safe acquisition', () => {
  const limiter = TwinTransport.getOutboundLimiter();

  assert.equal(typeof limiter.acquire, 'function');
});

test('outbound limiter supports upstream cooldown', () => {
  const limiter = TwinTransport.getOutboundLimiter();

  assert.equal(typeof limiter.recordResponse, 'function');
});
