import assert from 'node:assert/strict';
import { GhostService } from '../dist/mcp/ghost_service.js';
import { TwinTransport } from '../dist/twins/transport.js';

const originalRequest = TwinTransport.prototype.request;

TwinTransport.prototype.request = async (url) => {
  throw new Error(`OUTBOUND_NETWORK_LEAK: ${url}`);
};

try {
  const profile = {
    id: '123',
    username: 'targetuser',
    full_name: 'Target User',
    followers_count: 1000,
    following_count: 10,
    media_count: 3,
    is_verified: false,
    biography: null
  };

  const payload = {
    suggested_posts: {
      edges: [{
        node: {
          id: '999',
          code: 'suggested_post',
          owner: { id: '999', username: 'otheruser' }
        }
      }]
    },
    edge_owner_to_timeline_media: {
      page_info: { has_next_page: false },
      edges: [
        {
          node: {
            id: '1',
            code: 'valid_post',
            owner: { id: '123', username: 'targetuser' },
            like_count: 10
          }
        },
        {
          node: {
            id: '2',
            code: 'foreign_post',
            owner: { id: '999', username: 'otheruser' },
            like_count: 1000
          }
        },
        {
          node: {
            id: '3',
            code: 'ownerless_post',
            like_count: 5
          }
        }
      ]
    }
  };

  const html = `<script type="application/json">${JSON.stringify(payload)}</script>`;

  const svc = new GhostService(undefined, { offlineMode: false });

  svc.transport = {
    request: async (url) => {
      assert.ok(url.includes('instagram.com/targetuser/'));
      return { status: 200, data: html };
    }
  };

  const timeline = await svc.getTimelinePosts({
    username: 'targetuser',
    limit: 10,
    profile
  });

  assert.deepEqual(
    timeline.posts.map(post => post.shortcode),
    ['valid_post', 'ownerless_post']
  );

  assert.equal(timeline.retrieved_count, 2);
  assert.ok(!timeline.posts.some(post => post.shortcode === 'foreign_post'));
  assert.ok(!timeline.posts.some(post => post.shortcode === 'suggested_post'));

  console.log('PASS: Valid account posts accepted');
  console.log('PASS: Foreign and suggested posts excluded');
  console.log('PASS: Ownerless posts inside verified timeline accepted');
  console.log('PASS: No outbound network requests');
} finally {
  TwinTransport.prototype.request = originalRequest;
}
