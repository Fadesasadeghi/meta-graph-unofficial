import assert from 'node:assert/strict';
import { GhostService } from '../dist/mcp/ghost_service.js';
import { TwinTransport } from '../dist/twins/transport.js';

const originalRequest = TwinTransport.prototype.request;

TwinTransport.prototype.request = async (url) => {
  throw new Error(`OUTBOUND_NETWORK_LEAK: ${url}`);
};

try {
  const nodes = [
    {
      id: '1', code: 'zero_post', media_type: 1,
      is_video: false, like_count: 0, comment_count: 0
    },
    {
      id: '2', code: 'unknown_post', media_type: 1,
      is_video: false
    },
    {
      id: '3', code: 'partial_post', media_type: 1,
      is_video: false, like_count: 100
    }
  ];

  const html = `
    <script type="application/json">
    ${JSON.stringify({
      edge_owner_to_timeline_media: {
        page_info: { has_next_page: false },
        edges: nodes.map(node => ({ node }))
      }
    })}
    </script>
  `;

  const svc = new GhostService(undefined, { offlineMode: false });

  svc.transport = {
    request: async (url) => {
      assert.ok(url.includes('instagram.com/testuser/'));
      return { status: 200, data: html };
    }
  };

  const profile = {
    id: '123',
    username: 'testuser',
    full_name: 'Test User',
    followers_count: 1000,
    following_count: 0,
    media_count: 3,
    is_verified: false,
    biography: null
  };

  svc.getProfile = async () => profile;

  const timeline = await svc.getTimelinePosts({
    username: 'testuser',
    limit: 3,
    profile
  });

  assert.equal(timeline.posts.length, 3);

  assert.equal(timeline.posts[0].like_count, 0);
  assert.equal(timeline.posts[0].comment_count, 0);

  assert.equal(timeline.posts[1].like_count, null);
  assert.equal(timeline.posts[1].comment_count, null);

  assert.equal(timeline.posts[2].like_count, 100);
  assert.equal(timeline.posts[2].comment_count, null);

  const audit = await svc.auditAccount('testuser', 3);

  assert.equal(audit.aggregate_metrics.total_sampled_likes, 100);
  assert.equal(audit.aggregate_metrics.known_likes_count, 2);
  assert.equal(audit.aggregate_metrics.average_likes_per_post, 50);

  assert.equal(audit.aggregate_metrics.total_sampled_comments, 0);
  assert.equal(audit.aggregate_metrics.known_comments_count, 1);
  assert.equal(audit.aggregate_metrics.average_comments_per_post, 0);

  assert.equal(audit.aggregate_metrics.overall_engagement_rate_pct, 0);

  console.log('PASS: Zero, null, partial metrics and audit averages');
  console.log('PASS: No outbound network requests');
} finally {
  TwinTransport.prototype.request = originalRequest;
}
