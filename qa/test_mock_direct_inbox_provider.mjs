import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MockDirectInboxProvider
} from '../dist/providers/mock_direct_inbox_provider.js';

test('lists four MOCK conversations', async () => {
  const provider = new MockDirectInboxProvider();

  const result = await provider.listConversationIds(
    'demo-account-1'
  );

  assert.equal(result.ok, true);
  assert.equal(result.source, 'mock');

  if (!result.ok) return;

  assert.equal(result.data.length, 4);
  assert.ok(result.data.includes('demo-dm-pricing'));
  assert.ok(result.data.includes('demo-dm-order'));
});

test('reads a verified pricing conversation', async () => {
  const provider = new MockDirectInboxProvider();

  const result = await provider.listDirectMessages(
    'demo-account-1',
    'demo-dm-pricing'
  );

  assert.equal(result.ok, true);

  if (!result.ok) return;

  assert.equal(result.data.length, 1);
  assert.equal(
    result.data[0].id,
    'demo-message-pricing-1'
  );
  assert.match(result.data[0].text, /قیمت/);
});

test('rejects unknown accounts', async () => {
  const provider = new MockDirectInboxProvider();

  const result = await provider.listDirectMessages(
    'unknown-account',
    'demo-dm-pricing'
  );

  assert.equal(result.ok, false);

  if (result.ok) return;

  assert.equal(result.error.code, 'NOT_FOUND');
});

test('rejects unknown conversations', async () => {
  const provider = new MockDirectInboxProvider();

  const result = await provider.listDirectMessages(
    'demo-account-1',
    'missing-conversation'
  );

  assert.equal(result.ok, false);

  if (result.ok) return;

  assert.equal(result.error.code, 'NOT_FOUND');
});

test('rejects invalid identifiers', async () => {
  const provider = new MockDirectInboxProvider();

  const result = await provider.listDirectMessages(
    'demo-account-1',
    ' '
  );

  assert.equal(result.ok, false);

  if (result.ok) return;

  assert.equal(result.error.code, 'INVALID_REQUEST');
});

test('returned messages cannot mutate the mock dataset', async () => {
  const provider = new MockDirectInboxProvider();

  const first = await provider.listDirectMessages(
    'demo-account-1',
    'demo-dm-order'
  );

  assert.equal(first.ok, true);
  if (!first.ok) return;

  first.data[0].text = 'Modified text';

  const second = await provider.listDirectMessages(
    'demo-account-1',
    'demo-dm-order'
  );

  assert.equal(second.ok, true);
  if (!second.ok) return;

  assert.match(second.data[0].text, /سفارشم/);
});
