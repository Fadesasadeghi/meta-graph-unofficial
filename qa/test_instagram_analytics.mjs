import test from 'node:test';
import assert from 'node:assert/strict';
import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';
import { InstagramAnalyticsService } from '../dist/analytics/instagram_analytics_service.js';

const mock = new MockInstagramProvider();

test('calculates correct engagement rates', async () => {
  const result = await new InstagramAnalyticsService(mock)
    .analyzeAccount('demo-account-1');

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const report = result.data;
  assert.equal(report.source, 'mock');
  assert.equal(report.analyzedPostCount, 3);
  assert.equal(report.averageEngagementRatePct, 8.23);
  assert.equal(report.engagementRateDenominator, 'followers');
  assert.equal(report.rankedPosts[0].id, 'demo-post-1');
  assert.equal(report.rankedPosts[0].engagementRatePct, 10.68);
});

test('preserves missing metrics', async () => {
  const result = await new InstagramAnalyticsService(mock)
    .analyzeAccount('demo-account-1');

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.rankedPosts[2].engagementRatePct, null);
  assert.equal(result.data.dataQuality.postsWithMissingEngagement, 1);
  assert.equal(result.data.dataQuality.completeMediaHistory, true);
});

test('counts content types correctly', async () => {
  const result = await new InstagramAnalyticsService(mock)
    .analyzeAccount('demo-account-1');

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.data.contentMix, {
    image: 1,
    video: 0,
    carousel: 1,
    reel: 1
  });
});

test('does not divide by zero followers', async () => {
  const provider = Object.create(mock);
  provider.getProfile = async (id) => {
    const result = await mock.getProfile(id);
    if (!result.ok) return result;
    return {
      ...result,
      data: { ...result.data, followersCount: 0 }
    };
  };

  const result = await new InstagramAnalyticsService(provider)
    .analyzeAccount('demo-account-1');

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.averageEngagementRatePct, null);
  assert.equal(result.data.dataQuality.postsWithCompleteEngagement, 0);
});

test('propagates provider errors', async () => {
  const result = await new InstagramAnalyticsService(mock)
    .analyzeAccount('missing-account');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'NOT_FOUND');
  }
});

test('does not publish partial reports after pagination failure', async () => {
  const provider = Object.create(mock);
  provider.listMedia = async () => ({
    ok: false,
    source: 'mock',
    error: {
      code: 'RATE_LIMITED',
      message: 'Test rate limit',
      retryable: true
    }
  });

  const result = await new InstagramAnalyticsService(provider)
    .analyzeAccount('demo-account-1');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'RATE_LIMITED');
  }
});
