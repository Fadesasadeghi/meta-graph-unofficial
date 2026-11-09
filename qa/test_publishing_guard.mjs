import test from 'node:test';
import assert from 'node:assert/strict';

import { TwinGraph } from '../dist/twin_graph.js';
import { MediaTwin } from '../dist/twins/media_twin.js';

const story = { imageUrl: 'https://example.com/story.jpg' };

function isLiveBlocked(error) {
  return error?.name === 'LivePublishingNotConfiguredError';
}

test('Demo mode preserves simulated publishing', async () => {
  const demo = new TwinGraph({
    publishingMode: 'demo',
    offlineMode: true
  });

  const result = await demo.publishStory(story);
  assert.equal(result.status, 'ok');
});

test('Live mode blocks all MediaTwin publishing methods', async () => {
  const media = new MediaTwin(undefined, undefined, 'live');

  const operations = [
    () => media.createMediaContainer({}),
    () => media.checkContainerStatus('test'),
    () => media.publishMediaContainer('test'),
    () => media.publishMedia({}),
    () => media.publishFeedPost(story),
    () => media.publishStory(story),
    () => media.publishReel({
      videoUrl: 'https://example.com/reel.mp4'
    }),
    () => media.publishNote({ text: 'Test note' })
  ];

  for (const operation of operations) {
    await assert.rejects(operation, isLiveBlocked);
  }
});

test('TwinGraph Live mode blocks publishing', async () => {
  const live = new TwinGraph({
    publishingMode: 'live',
    offlineMode: true
  });

  await assert.rejects(
    () => live.publishStory(story),
    isLiveBlocked
  );

  await assert.rejects(
    () => live.publishNote({ text: 'Test' }),
    isLiveBlocked
  );
});

test('media_publish rejects missing container ID', async () => {
  const demo = new TwinGraph({
    publishingMode: 'demo',
    offlineMode: true
  });

  await assert.rejects(
    () => demo.api('/me/media_publish', 'POST', {}),
    /Missing required field 'creation_id'/
  );
});

test('media_publish cannot bypass Live guard', async () => {
  const live = new TwinGraph({
    publishingMode: 'live',
    offlineMode: true
  });

  await assert.rejects(
    () => live.api('/me/media_publish', 'POST', {
      creation_id: 'test-container'
    }),
    isLiveBlocked
  );

  await assert.rejects(
    () => live.api('/me/media', 'POST', {}),
    isLiveBlocked
  );
});
