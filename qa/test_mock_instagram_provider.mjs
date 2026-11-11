import test from 'node:test';
import assert from 'node:assert/strict';
import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';

const provider = new MockInstagramProvider();

test('mock profile is explicitly labeled', async () => {
  const result = await provider.getProfile('demo-account-1');

  assert.equal(result.ok, true);
  assert.equal(result.source, 'mock');

  if (result.ok) {
    assert.equal(result.data.username, 'demo.creator');
    assert.equal(result.data.followersCount, 12500);
  }
});

test('mock media is returned with correct account IDs', async () => {
  const result = await provider.listMedia('demo-account-1');

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.data.items.length, 3);
    assert.ok(
      result.data.items.every(
        item => item.accountId === 'demo-account-1'
      )
    );
  }
});

test('pagination returns distinct pages', async () => {
  const first = await provider.listMedia(
    'demo-account-1',
    { limit: 2 }
  );

  assert.equal(first.ok, true);
  if (!first.ok) return;

  assert.equal(first.data.items.length, 2);
  assert.equal(first.data.nextCursor, '2');

  const second = await provider.listMedia(
    'demo-account-1',
    { limit: 2, cursor: first.data.nextCursor }
  );

  assert.equal(second.ok, true);
  if (!second.ok) return;

  assert.equal(second.data.items.length, 1);
  assert.equal(second.data.nextCursor, null);
  assert.notEqual(
    first.data.items[0].id,
    second.data.items[0].id
  );
});

test('media insights preserve missing values as null', async () => {
  const result = await provider.getMediaInsights(
    'demo-account-1',
    'demo-post-3'
  );

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.data.reach, null);
    assert.equal(result.data.saves, 95);
  }
});

test('comments are returned only for existing media', async () => {
  const result = await provider.listComments(
    'demo-account-1',
    'demo-post-1'
  );

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.data.items.length, 1);
    assert.equal(result.data.items[0].text, 'Great content!');
  }

  const missing = await provider.listComments(
    'demo-account-1',
    'unknown-post'
  );

  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.error.code, 'NOT_FOUND');
  }
});

test('invalid requests return structured errors', async () => {
  const missing = await provider.getProfile('unknown-account');

  assert.equal(missing.ok, false);
  assert.equal(missing.source, 'mock');

  if (!missing.ok) {
    assert.equal(missing.error.code, 'NOT_FOUND');
  }

  const invalid = await provider.listMedia(
    'demo-account-1',
    { limit: -1 }
  );

  assert.equal(invalid.ok, false);

  if (!invalid.ok) {
    assert.equal(invalid.error.code, 'INVALID_REQUEST');
  }
});
