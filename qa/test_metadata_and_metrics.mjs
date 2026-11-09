/**
 * qa/test_metadata_and_metrics.mjs
 *
 * Focused fixture-based tests for Instagram profile metadata, nullable fields,
 * and engagement metric calculations in Ghost MCP service.
 * Zero real Instagram network requests.
 */

import assert from 'node:assert/strict';
import { GhostService } from '../dist/mcp/ghost_service.js';
import { TwinTransport } from '../dist/twins/transport.js';

console.log('=== Starting Ghost Mode Profile Metadata & Metrics Fixture Tests ===\n');

// ----------------------------------------------------------------------------
// Global Network Request Trap (Safety verification)
// ----------------------------------------------------------------------------
let networkCalls = [];
const originalRequest = TwinTransport.prototype.request;
TwinTransport.prototype.request = async function (url, ...args) {
  const err = new Error(`OUTBOUND_NETWORK_LEAK: Forbidden network request to ${url}`);
  networkCalls.push({ url, stack: err.stack });
  throw err;
};

// Helper to create a GhostService with mocked response fixtures
function createMockService(fixturesByUrl = {}) {
  const svc = new GhostService(undefined, { offlineMode: false });
  svc.transport = {
    request: async (url, options = {}) => {
      for (const [key, response] of Object.entries(fixturesByUrl)) {
        if (url.includes(key)) {
          return {
            status: response.status ?? 200,
            statusText: response.statusText ?? 'OK',
            headers: response.headers ?? {},
            data: response.data ?? ''
          };
        }
      }
      throw new Error(`MOCK_FIXTURE_NOT_FOUND: No fixture registered for ${url}`);
    }
  };
  return svc;
}

try {
  // --------------------------------------------------------------------------
  // Test 1: Complete Profile Fixture (Valid guest data extraction)
  // --------------------------------------------------------------------------
  console.log('[Test 1] Complete profile fixture with full metadata');
  const completeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="Jane Doe (@janedoe) • Instagram photos and videos">
  <meta name="description" content="1.2M Followers, 450 Following, 300 Posts - See Instagram photos from Jane">
  <meta content="1.2M Followers, 450 Following, 300 Posts - on Instagram: &quot;Official Jane Doe account.&quot;">
</head>
<body>
  <script type="application/json">
  {
    "user": {
      "username": "janedoe",
      "id": "99887766",
      "full_name": "Jane Doe",
      "biography": "Official Jane Doe account.",
      "profile_pic_url_hd": "https://cdn.example.com/jane_hd.jpg",
      "external_url": "https://janedoe.com",
      "follower_count": 1200000,
      "following_count": 450,
      "media_count": 300,
      "is_verified": true,
      "is_private": false,
      "is_business": true
    }
  }
  </script>
</body>
</html>`;

  const svc1 = createMockService({ 'instagram.com/janedoe/': { data: completeHtml } });
  const profile1 = await svc1.getProfile('janedoe');

  assert.equal(profile1.id, '99887766');
  assert.equal(profile1.username, 'janedoe');
  assert.equal(profile1.full_name, 'Jane Doe');
  assert.equal(profile1.biography, 'Official Jane Doe account.');
  assert.equal(profile1.external_url, 'https://janedoe.com');
  assert.equal(profile1.followers_count, 1200000);
  assert.equal(profile1.following_count, 450);
  assert.equal(profile1.media_count, 300);
  assert.equal(profile1.is_verified, true);
  assert.equal(profile1.is_private, false);
  assert.equal(profile1.is_business, true);
  assert.equal(profile1.profile_pic_url, 'https://cdn.example.com/jane_hd.jpg');
  console.log('  PASS: All complete metadata fields parsed accurately');

  // --------------------------------------------------------------------------
  // Test 2: Actual Zero & Explicit False Metadata (Must NOT be converted to null)
  // --------------------------------------------------------------------------
  console.log('[Test 2] Actual zero counts and explicit false flags');
  const zeroHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="0 Followers, 0 Following, 0 Posts">
</head>
<body>
  <script type="application/json">
  {
    "user": {
      "username": "zerouser",
      "id": "10001",
      "full_name": "Zero User",
      "follower_count": 0,
      "following_count": 0,
      "media_count": 0,
      "is_verified": false,
      "is_private": true,
      "is_business": false
    }
  }
  </script>
</body>
</html>`;

  const svc2 = createMockService({ 'instagram.com/zerouser/': { data: zeroHtml } });
  const profile2 = await svc2.getProfile('zerouser');

  assert.strictEqual(profile2.followers_count, 0, 'Actual 0 followers must remain 0 (not null)');
  assert.strictEqual(profile2.following_count, 0, 'Actual 0 following must remain 0 (not null)');
  assert.strictEqual(profile2.media_count, 0, 'Actual 0 posts must remain 0 (not null)');
  assert.strictEqual(profile2.is_verified, false, 'Explicit is_verified: false must be preserved');
  assert.strictEqual(profile2.is_private, true, 'Explicit is_private: true must be preserved');
  assert.strictEqual(profile2.is_business, false, 'Explicit is_business: false must be preserved');
  console.log('  PASS: Actual 0 and explicit false/true values preserved');

  // --------------------------------------------------------------------------
  // Test 3: Missing Metadata Fixture (Must return null, NOT fabricated 0/false)
  // --------------------------------------------------------------------------
  console.log('[Test 3] Missing metadata returns null (not fabricated defaults)');
  const missingHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Instagram</title>
</head>
<body>
  <p>Some guest landing page without metrics</p>
</body>
</html>`;

  const svc3 = createMockService({ 'instagram.com/sparseuser/': { data: missingHtml } });
  const profile3 = await svc3.getProfile('sparseuser');

  assert.strictEqual(profile3.id, null, 'Missing id must be null');
  assert.strictEqual(profile3.followers_count, null, 'Missing followers must be null (not 0)');
  assert.strictEqual(profile3.following_count, null, 'Missing following must be null (not 0)');
  assert.strictEqual(profile3.media_count, null, 'Missing media count must be null (not 0)');
  assert.strictEqual(profile3.is_verified, null, 'Missing is_verified must be null (not false)');
  assert.strictEqual(profile3.is_private, null, 'Missing is_private must be null (not false)');
  assert.strictEqual(profile3.is_business, null, 'Missing is_business must be null (not true)');
  assert.strictEqual(profile3.biography, null, 'Missing bio must be null');
  assert.strictEqual(profile3.full_name, null, 'Missing full_name must be null');
  assert.strictEqual(profile3.profile_pic_url, null, 'Missing profile_pic_url must be null');
  console.log('  PASS: Missing metadata safely returns null across all fields');

  // --------------------------------------------------------------------------
  // Test 4: Correct Association of Profile Flags in Script
  // --------------------------------------------------------------------------
  console.log('[Test 4] Flags extracted only from correctly associated profile object');
  const multiUserHtml = `<!DOCTYPE html>
<html>
<body>
  <script type="application/json">
  {
    "feed": [
      { "username": "unrelated_user", "is_verified": true, "is_private": true, "is_business": true }
    ],
    "target": {
      "username": "myaccount",
      "id": "777",
      "is_verified": false,
      "is_private": false,
      "is_business": false
    }
  }
  </script>
</body>
</html>`;

  const svc4 = createMockService({ 'instagram.com/myaccount/': { data: multiUserHtml } });
  const profile4 = await svc4.getProfile('myaccount');

  assert.strictEqual(profile4.id, '777');
  assert.strictEqual(profile4.is_verified, false, 'Must match target account is_verified (false)');
  assert.strictEqual(profile4.is_private, false, 'Must match target account is_private (false)');
  assert.strictEqual(profile4.is_business, false, 'Must match target account is_business (false)');
  console.log('  PASS: Only correctly associated user object flags extracted');

  // --------------------------------------------------------------------------
  // Test 5: Media Metrics with View Denominator
  // --------------------------------------------------------------------------
  console.log('[Test 5] Media metrics engagement rate with video views denominator');
  const reelHtml = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:type" content="video">
  <meta name="description" content="1,000 likes, 100 comments">
</head>
<body>
  <script type="application/json">
  {
    "xdt_shortcode_media": {
      "like_count": 1000,
      "comment_count": 100,
      "video_play_count": 20000,
      "is_video": true
    }
  }
  </script>
</body>
</html>`;

  const svc5 = createMockService({ 'instagram.com/reel/TESTREEL/': { data: reelHtml } });
  const metrics5 = await svc5.getMediaMetrics('TESTREEL');

  assert.strictEqual(metrics5.metrics.video_plays, 20000);
  assert.strictEqual(metrics5.metrics.likes, 1000);
  assert.strictEqual(metrics5.metrics.comments, 100);
  // (1100 / 20000) * 100 = 5.50
  assert.strictEqual(metrics5.metrics.engagement_rate, 5.5);
  assert.strictEqual(metrics5.metrics.engagement_rate_denominator, 'views');
  assert.strictEqual(metrics5.metrics.comment_to_like_ratio, 0.1);
  console.log('  PASS: View-based engagement rate calculated with denominator: "views"');

  // --------------------------------------------------------------------------
  // Test 6: Media Metrics with Missing Plays (Image Post) returns null
  // --------------------------------------------------------------------------
  console.log('[Test 6] Media metrics with missing plays returns null (not 0)');
  const imageHtml = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:type" content="article">
  <meta name="description" content="500 likes, 50 comments">
</head>
<body>
  <script type="application/json">
  {
    "xdt_shortcode_media": {
      "like_count": 500,
      "comment_count": 50,
      "is_video": false
    }
  }
  </script>
</body>
</html>`;

  const svc6 = createMockService({ 'instagram.com/reel/TESTIMG/': { data: imageHtml } });
  const metrics6 = await svc6.getMediaMetrics('TESTIMG');

  assert.strictEqual(metrics6.metrics.engagement_rate, null, 'Must be null when view denominator missing');
  assert.strictEqual(metrics6.metrics.engagement_rate_denominator, null);
  assert.strictEqual(metrics6.metrics.comment_to_like_ratio, 0.1);
  console.log('  PASS: Null engagement rate returned when view denominator is unavailable');

  // --------------------------------------------------------------------------
  // Test 7: Media Metrics with 0 Likes (Ratio denominator safety)
  // --------------------------------------------------------------------------
  console.log('[Test 7] Zero likes returns null for comment_to_like_ratio');
  const zeroLikeHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="0 likes, 10 comments">
</head>
<body>
  <script type="application/json">
  {
    "xdt_shortcode_media": {
      "like_count": 0,
      "comment_count": 10
    }
  }
  </script>
</body>
</html>`;

  const svc7 = createMockService({ 'instagram.com/reel/ZEROLIKE/': { data: zeroLikeHtml } });
  const metrics7 = await svc7.getMediaMetrics('ZEROLIKE');

  assert.strictEqual(metrics7.metrics.comment_to_like_ratio, null, 'Division by 0 likes must be null');
  console.log('  PASS: Zero likes produces null comment_to_like_ratio safely');

  // --------------------------------------------------------------------------
  // Test 8: Audit Calculations with Complete Sample
  // --------------------------------------------------------------------------
  console.log('[Test 8] Account audit with complete sample and follower denominator');
  const auditProfileHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="10,000 Followers, 200 Following, 4 Posts">
</head>
<body>
  <script type="application/json">
  {
    "user": {
      "username": "creator",
      "id": "111",
      "full_name": "Top Creator",
      "follower_count": 10000,
      "following_count": 200,
      "media_count": 4,
      "is_verified": true,
      "is_private": false,
      "is_business": true
    }
  }
  </script>
</body>
</html>`;

  const timelinePayload = {
    edge_owner_to_timeline_media: {
      page_info: { has_next_page: false },
      edges: [
        {
          node: {
            id: 'R1', code: 'reel1', media_type: 2, is_video: true,
            like_count: 500, comment_count: 50, video_play_count: 5000,
            caption: { text: 'Reel 1' }
          }
        },
        {
          node: {
            id: 'R2', code: 'reel2', media_type: 2, is_video: true,
            like_count: 300, comment_count: 30, video_play_count: 3000,
            caption: { text: 'Reel 2' }
          }
        },
        {
          node: {
            id: 'P1', code: 'post1', media_type: 1, is_video: false,
            like_count: 200, comment_count: 20,
            caption: { text: 'Post 1' }
          }
        },
        {
          node: {
            id: 'P2', code: 'post2', media_type: 1, is_video: false,
            like_count: 100, comment_count: 10,
            caption: { text: 'Post 2' }
          }
        }
      ]
    }
  };

  // Combined realistic Instagram SSR HTML having both user profile and timeline edges
  const unifiedCreatorHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="10,000 Followers, 200 Following, 4 Posts">
</head>
<body>
  <script type="application/json">
  {
    "user": {
      "username": "creator",
      "id": "111",
      "full_name": "Top Creator",
      "follower_count": 10000,
      "following_count": 200,
      "media_count": 4,
      "is_verified": true,
      "is_private": false,
      "is_business": true
    },
    "edge_owner_to_timeline_media": ${JSON.stringify(timelinePayload.edge_owner_to_timeline_media)}
  }
  </script>
</body>
</html>`;

  const svc8 = createMockService({
    'instagram.com/creator/': { data: unifiedCreatorHtml }
  });

  const auditReport8 = await svc8.auditAccount('creator', 4);

  assert.strictEqual(auditReport8.analyzed_sample_size, 4);
  assert.strictEqual(auditReport8.aggregate_metrics.total_sampled_plays, 8000);
  assert.strictEqual(auditReport8.aggregate_metrics.average_plays_per_reel, 4000);
  assert.strictEqual(auditReport8.aggregate_metrics.total_sampled_likes, 1100);
  assert.strictEqual(auditReport8.aggregate_metrics.average_likes_per_post, 275);
  assert.strictEqual(auditReport8.aggregate_metrics.total_sampled_comments, 110);
  assert.strictEqual(auditReport8.aggregate_metrics.average_comments_per_post, 28);
  // (275 + 28) / 10000 * 100 = 3.03%
  assert.strictEqual(auditReport8.aggregate_metrics.overall_engagement_rate_pct, 3.03);
  assert.strictEqual(auditReport8.content_mix.reels_share_pct, 50);

  // Top reel: (550 / 5000) * 100 = 11% with views denominator
  assert.strictEqual(auditReport8.top_performing_reels[0].engagement_rate, 11);
  assert.strictEqual(auditReport8.top_performing_reels[0].engagement_rate_denominator, 'views');
  assert.strictEqual(auditReport8.top_performing_reels[0].plays, 5000);
  console.log('  PASS: Account audit aggregate metrics and reel view denominators verified');

  // --------------------------------------------------------------------------
  // Test 9: Audit with Zero Sample Size (Empty Timeline) returns null metrics
  // --------------------------------------------------------------------------
  console.log('[Test 9] Account audit with 0 sample size returns null (not 0 / NaN)');
  const emptyTimelinePayload = {
    edge_owner_to_timeline_media: {
      page_info: { has_next_page: false },
      edges: []
    }
  };
  const emptyTimelineHtml = `<!DOCTYPE html>
<html>
<body>
  <script type="application/json">${JSON.stringify(emptyTimelinePayload)}</script>
</body>
</html>`;

  const svc9 = createMockService({
    'instagram.com/emptypage/': { data: emptyTimelineHtml },
    'instagram.com/emptypage': { data: auditProfileHtml }
  });

  const auditReport9 = await svc9.auditAccount('emptypage', 5);

  assert.strictEqual(auditReport9.analyzed_sample_size, 0);
  assert.strictEqual(auditReport9.aggregate_metrics.average_plays_per_reel, null);
  assert.strictEqual(auditReport9.aggregate_metrics.average_likes_per_post, null);
  assert.strictEqual(auditReport9.aggregate_metrics.average_comments_per_post, null);
  assert.strictEqual(auditReport9.aggregate_metrics.overall_engagement_rate_pct, null);
  assert.strictEqual(auditReport9.content_mix.reels_share_pct, null);
  assert.strictEqual(auditReport9.top_performing_reels.length, 0);
  assert.strictEqual(auditReport9.discussion_driver_posts.length, 0);
  console.log('  PASS: Zero posts sample cleanly returns null for averages and engagement rates');

  // --------------------------------------------------------------------------
  // Test 10: Audit with Missing Followers (Denominator Unavailable)
  // --------------------------------------------------------------------------
  console.log('[Test 10] Audit with missing follower count returns null engagement');
  const noFollowersTimelineHtml = `<!DOCTYPE html>
<html>
<body>
  <script type="application/json">
  {
    "edge_owner_to_timeline_media": ${JSON.stringify(timelinePayload.edge_owner_to_timeline_media)}
  }
  </script>
</body>
</html>`;

  const svc10 = createMockService({
    'instagram.com/nofollower/': { data: noFollowersTimelineHtml }
  });

  const auditReport10 = await svc10.auditAccount('nofollower', 4);

  assert.strictEqual(auditReport10.target.followers, null);
  assert.strictEqual(auditReport10.aggregate_metrics.overall_engagement_rate_pct, null,
    'Overall engagement must be null when follower denominator is unknown');
  console.log('  PASS: Null follower count results in null overall engagement rate');

  // --------------------------------------------------------------------------
  // Test 11: Reel Fallback to Followers Denominator in Audit
  // --------------------------------------------------------------------------
  console.log('[Test 11] Reel engagement rate fallback to followers denominator');
  const reelNoPlaysTimeline = {
    edge_owner_to_timeline_media: {
      page_info: { has_next_page: false },
      edges: [
        {
          node: {
            id: 'R_NOPLAYS', code: 'reel_noplay', media_type: 2, is_video: true,
            like_count: 500, comment_count: 50, /* no video_play_count */
            caption: { text: 'Reel without play count' }
          }
        }
      ]
    }
  };

  const unifiedNoPlaysHtml = `<!DOCTYPE html>
<html>
<head>
  <meta name="description" content="10,000 Followers, 200 Following, 1 Posts">
</head>
<body>
  <script type="application/json">
  {
    "user": {
      "username": "creator",
      "id": "111",
      "full_name": "Top Creator",
      "follower_count": 10000,
      "following_count": 200,
      "media_count": 1,
      "is_verified": true,
      "is_private": false,
      "is_business": true
    },
    "edge_owner_to_timeline_media": ${JSON.stringify(reelNoPlaysTimeline.edge_owner_to_timeline_media)}
  }
  </script>
</body>
</html>`;

  const svc11 = createMockService({
    'instagram.com/creator/': { data: unifiedNoPlaysHtml }
  });

  const auditReport11 = await svc11.auditAccount('creator', 1);
  const topReel = auditReport11.top_performing_reels[0];

  assert.strictEqual(topReel.plays, null, 'Plays must be null when unknown');
  // (550 / 10000) * 100 = 5.5% using followers denominator
  assert.strictEqual(topReel.engagement_rate, 5.5);
  assert.strictEqual(topReel.engagement_rate_denominator, 'followers',
    'Reel must explicitly identify followers as denominator');
  console.log('  PASS: Follower denominator explicitly identified when view plays missing');

  // Test 12: Missing likes/comments must remain null
  console.log('[Test 12] Missing engagement counts are not fabricated');
  const missingCountsHtml = `<!DOCTYPE html>
<html><body><script type="application/json">
{"xdt_shortcode_media":{"video_play_count":1000,"is_video":true}}
</script></body></html>`;

  const svc12 = createMockService({
    'instagram.com/reel/MISSINGCOUNTS/': { data: missingCountsHtml }
  });
  const metrics12 = await svc12.getMediaMetrics('MISSINGCOUNTS');

  assert.strictEqual(metrics12.metrics.likes, null);
  assert.strictEqual(metrics12.metrics.comments, null);
  assert.strictEqual(metrics12.metrics.engagement_rate, null);
  assert.strictEqual(metrics12.metrics.engagement_rate_denominator, null);
  assert.strictEqual(metrics12.metrics.comment_to_like_ratio, null);
  console.log('  PASS: Unknown counts and derived metrics remain null');

  // Test 13: Missing reel plays must not reduce the observed average
  console.log('[Test 13] Reel averages exclude unknown play counts');
  const partialTimeline = {
    edge_owner_to_timeline_media: {
      page_info: { has_next_page: false },
      edges: [
        { node: {
          id: 'RA', code: 'reela', media_type: 2, is_video: true,
          like_count: 100, comment_count: 10, video_play_count: 1000
        }},
        { node: {
          id: 'RB', code: 'reelb', media_type: 2, is_video: true,
          like_count: 100, comment_count: 10
        }},
        { node: {
          id: 'RC', code: 'reelc', media_type: 2, is_video: true,
          like_count: 100, comment_count: 10, video_play_count: 2000
        }}
      ]
    }
  };

  const partialAuditHtml = `<!DOCTYPE html>
<html><head>
<meta name="description" content="10,000 Followers, 100 Following, 3 Posts">
</head><body><script type="application/json">
{
  "user": {
    "username": "partialcreator",
    "id": "12345",
    "full_name": "Partial Creator",
    "follower_count": 10000,
    "following_count": 100,
    "media_count": 3,
    "is_private": false
  },
  "edge_owner_to_timeline_media": ${JSON.stringify(partialTimeline.edge_owner_to_timeline_media)}
}
</script></body></html>`;

  const svc13 = createMockService({
    'instagram.com/partialcreator/': { data: partialAuditHtml }
  });
  const report13 = await svc13.auditAccount('partialcreator', 3);

  assert.strictEqual(report13.analyzed_sample_size, 3);
  assert.strictEqual(report13.aggregate_metrics.total_sampled_plays, 3000);
  assert.strictEqual(report13.aggregate_metrics.average_plays_per_reel, 1500);
  console.log('  PASS: Known plays 1000 and 2000 produce average 1500');

  // Test 14: Independent extraction of partial JSON metrics
  console.log('[Test 14] Partial JSON metrics are extracted independently');

  for (const [code, fields, expected] of [
    ['ONLYLIKES', { like_count: 25 }, { likes: 25, comments: null, video_plays: undefined }],
    ['ONLYCOMMENTS', { comment_count: 7 }, { likes: null, comments: 7, video_plays: undefined }],
    ['ONLYPLAYS', { video_play_count: 1200 }, { likes: null, comments: null, video_plays: 1200 }]
  ]) {
    const html = `<html><body><script type="application/json">${
      JSON.stringify({ xdt_shortcode_media: fields })
    }</script></body></html>`;

    const svc = createMockService({
      [`instagram.com/reel/${code}/`]: { data: html }
    });

    const result = await svc.getMediaMetrics(code);

    assert.strictEqual(result.metrics.likes, expected.likes);
    assert.strictEqual(result.metrics.comments, expected.comments);
    assert.strictEqual(result.metrics.video_plays, expected.video_plays);
    assert.strictEqual(result.metrics.engagement_rate, null);
  }

  console.log('  PASS: Likes, comments and plays are independently extracted');

  // Final verification: ZERO network calls leaked
  assert.strictEqual(networkCalls.length, 0, 'Zero network calls leaked across all tests');
  console.log('\n=== All Metadata & Metrics Fixture Tests Passed (0 network leaks) ===');
} finally {
  TwinTransport.prototype.request = originalRequest;
}
