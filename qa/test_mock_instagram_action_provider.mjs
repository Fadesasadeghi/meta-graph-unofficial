import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  MockInstagramActionProvider
} from '../dist/providers/mock_instagram_action_provider.js';

const publishRequest = (key = randomUUID()) => ({
  accountId: 'demo-account-1',
  type: 'story',
  mediaUrl: 'https://example.com/story.jpg',
  idempotencyKey: key
});

test('reports simulated action capabilities', async () => {
  const provider = new MockInstagramActionProvider();
  const result = await provider.getCapabilities('demo-account-1');

  assert.equal(result.ok, true);
  assert.equal(result.source, 'mock');

  if (!result.ok) return;

  assert.equal(result.data.publishStory, true);
  assert.equal(result.data.replyToComment, true);
  assert.equal(result.data.sendDirectMessage, true);
});

test('simulates publishing without a real Instagram ID', async () => {
  const provider = new MockInstagramActionProvider();

  for (const type of ['post', 'story', 'reel']) {
    const result = await provider.publishContent({
      ...publishRequest(),
      type
    });

    assert.equal(result.ok, true);

    if (!result.ok) continue;

    assert.equal(result.data.simulated, true);
    assert.equal(result.data.type, type);
    assert.ok(result.data.mediaId.startsWith('mock-'));
  }
});

test('returns the same result for repeated requests', async () => {
  const provider = new MockInstagramActionProvider();
  const request = publishRequest('same-key');

  const first = await provider.publishContent(request);
  const second = await provider.publishContent(request);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  if (!first.ok || !second.ok) return;

  assert.equal(first.data.mediaId, second.data.mediaId);
});

test('rejects idempotency key reuse with different content', async () => {
  const provider = new MockInstagramActionProvider();
  const request = publishRequest('duplicate-key');

  const first = await provider.publishContent(request);
  const second = await provider.publishContent({
    ...request,
    mediaUrl: 'https://example.com/different.jpg'
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);

  if (second.ok) return;

  assert.equal(second.error.code, 'INVALID_REQUEST');
});

test('rejects invalid publishing requests', async () => {
  const provider = new MockInstagramActionProvider();

  const invalidUrl = await provider.publishContent({
    ...publishRequest(),
    mediaUrl: 'file:///private/story.jpg'
  });

  assert.equal(invalidUrl.ok, false);

  const missingKey = await provider.publishContent({
    ...publishRequest(),
    idempotencyKey: ''
  });

  assert.equal(missingKey.ok, false);
});

test('simulates comment replies and direct messages', async () => {
  const provider = new MockInstagramActionProvider();

  const comment = await provider.replyToComment({
    accountId: 'demo-account-1',
    commentId: 'comment-1',
    text: 'Thanks for your comment!',
    idempotencyKey: 'comment-key'
  });

  const direct = await provider.sendDirectMessage({
    accountId: 'demo-account-1',
    conversationId: 'conversation-1',
    text: 'Hello!',
    idempotencyKey: 'direct-key'
  });

  assert.equal(comment.ok, true);
  assert.equal(direct.ok, true);

  if (!comment.ok || !direct.ok) return;

  assert.equal(comment.data.simulated, true);
  assert.equal(direct.data.simulated, true);
  assert.ok(comment.data.actionId.startsWith('mock-'));
  assert.ok(direct.data.actionId.startsWith('mock-'));
});

test('returns an empty simulated inbox', async () => {
  const provider = new MockInstagramActionProvider();

  const result = await provider.listDirectMessages(
    'demo-account-1',
    'conversation-1'
  );

  assert.equal(result.ok, true);

  if (!result.ok) return;

  assert.deepEqual(result.data, []);
});
