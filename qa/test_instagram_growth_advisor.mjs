import test from 'node:test';
import assert from 'node:assert/strict';

import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';
import { InstagramAnalyticsService } from '../dist/analytics/instagram_analytics_service.js';
import { InstagramGrowthAdvisor } from '../dist/advisor/instagram_growth_advisor.js';

const advisor = new InstagramGrowthAdvisor();

async function demoReport() {
  const analytics = new InstagramAnalyticsService(
    new MockInstagramProvider()
  );

  const result = await analytics.analyzeAccount('demo-account-1');
  assert.equal(result.ok, true);

  return result.data;
}

test('generates two evidence-based experiments', async () => {
  const advice = advisor.generate(await demoReport());

  assert.equal(advice.experiments.length, 2);
  assert.equal(advice.source, 'mock');

  for (const experiment of advice.experiments) {
    assert.ok(experiment.hypothesis);
    assert.ok(experiment.evidence.length > 0);
    assert.ok(experiment.action);
    assert.ok(experiment.successMetrics.length > 0);
    assert.ok(experiment.limitations.length > 0);
  }
});

test('reports low confidence for small samples', async () => {
  const advice = advisor.generate(await demoReport());

  assert.ok(
    advice.experiments.every(item => item.confidence === 'low')
  );

  assert.ok(
    advice.warnings.some(item => item.includes('Fewer than five'))
  );
});

test('clearly identifies simulated data', async () => {
  const advice = advisor.generate(await demoReport());

  assert.ok(
    advice.warnings.some(item => item.includes('simulated data'))
  );
});

test('does not invent top-post evidence when engagement is missing', async () => {
  const report = await demoReport();

  report.rankedPosts = report.rankedPosts.map(post => ({
    ...post,
    engagementRatePct: null
  }));

  report.dataQuality.postsWithCompleteEngagement = 0;
  report.dataQuality.postsWithMissingEngagement =
    report.analyzedPostCount;

  const advice = advisor.generate(report);

  assert.ok(
    !advice.experiments.some(
      item => item.id === 'repeat-top-content-pattern'
    )
  );
});

test('handles empty account data without fabricating experiments', async () => {
  const report = await demoReport();

  report.rankedPosts = [];
  report.analyzedPostCount = 0;
  report.contentMix = {
    image: 0,
    video: 0,
    carousel: 0,
    reel: 0
  };

  report.dataQuality.postsWithCompleteEngagement = 0;
  report.dataQuality.postsWithMissingEngagement = 0;

  const advice = advisor.generate(report);

  assert.equal(advice.experiments.length, 0);
  assert.ok(
    advice.warnings.some(item => item.includes('Not enough usable'))
  );
});

test('warns when retrieved media history is incomplete', async () => {
  const report = await demoReport();
  report.dataQuality.completeMediaHistory = false;

  const advice = advisor.generate(report);

  assert.ok(
    advice.warnings.some(item => item.includes('history is incomplete'))
  );
});
