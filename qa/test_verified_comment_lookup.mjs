import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MockInstagramProvider
} from '../dist/providers/mock_instagram_provider.js';

import {
  VerifiedCommentLookup
} from '../dist/comments/verified_comment_lookup.js';

const lookup = new VerifiedCommentLookup(
  new MockInstagramProvider()
);

test('finds a verified mock comment', async () => {
  const comment = await lookup.find(
    'demo-account-1',
    'demo-post-1',
    'demo-comment-1'
  );

  assert.equal(comment.id, 'demo-comment-1');
  assert.equal(comment.mediaId, 'demo-post-1');
  assert.equal(comment.text, 'Great content!');
});

test('rejects a nonexistent comment', async () => {
  await assert.rejects(
    lookup.find(
      'demo-account-1',
      'demo-post-1',
      'nonexistent-comment'
    ),
    /Comment not found/
  );
});

test('rejects a comment belonging to another post', async () => {
  await assert.rejects(
    lookup.find(
      'demo-account-1',
      'demo-post-2',
      'demo-comment-1'
    ),
    /Comment not found/
  );
});

test('rejects an unknown provider account', async () => {
  await assert.rejects(
    lookup.find(
      'unknown-account',
      'demo-post-1',
      'demo-comment-1'
    ),
    /Provider account could not be verified/
  );
});

test('rejects live providers in mock verification', async () => {
  const provider = new MockInstagramProvider();

  const fakeLiveProvider = {
    source: 'live',
    getProfile: (...args) => provider.getProfile(...args),
    listComments: (...args) => provider.listComments(...args)
  };

  const liveLookup = new VerifiedCommentLookup(
    fakeLiveProvider
  );

  await assert.rejects(
    liveLookup.find(
      'demo-account-1',
      'demo-post-1',
      'demo-comment-1'
    ),
    /Only MOCK verification is supported/
  );
});

test('rejects invalid identifiers', async () => {
  await assert.rejects(
    lookup.find(
      'demo-account-1',
      '',
      'demo-comment-1'
    ),
    /Valid account, media and comment IDs/
  );

  await assert.rejects(
    lookup.find(
      'demo-account-1',
      'demo-post-1',
      ' '
    ),
    /Valid account, media and comment IDs/
  );
});
