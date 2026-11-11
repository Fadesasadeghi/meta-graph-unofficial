import test from 'node:test';
import assert from 'node:assert/strict';

import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';
import { InstagramAnalyticsService } from '../dist/analytics/instagram_analytics_service.js';
import { InstagramGrowthAdvisor } from '../dist/advisor/instagram_growth_advisor.js';
import { GrowthDraftPreparer } from '../dist/advisor/growth_draft_preparer.js';

async function getAdvice() {
  const analytics = new InstagramAnalyticsService(
    new MockInstagramProvider()
  );

  const result = await analytics.analyzeAccount('demo-account-1');
  assert.equal(result.ok, true);

  if (!result.ok) {
    throw new Error('Demo analytics failed.');
  }

  return new InstagramGrowthAdvisor().generate(result.data);
}

test('prepares an editable reel draft from growth advice', async () => {
  const advice = await getAdvice();

  const prepared = new GrowthDraftPreparer().prepare(
    advice,
    'repeat-top-content-pattern',
    'reel'
  );

  assert.equal(prepared.source, 'mock');
  assert.equal(prepared.sourceAccountId, 'demo-account-1');
  assert.equal(prepared.experimentId, 'repeat-top-content-pattern');
  assert.equal(prepared.draft.type, 'reel');
  assert.equal(prepared.draft.mediaUrl, undefined);
  assert.equal(prepared.requiresApproval, true);
  assert.equal(prepared.saved, false);

  assert.ok(prepared.draft.caption.includes('موضوع محتوا:'));
  assert.ok(prepared.guidance.hypothesis);
  assert.ok(prepared.guidance.action);
  assert.ok(prepared.guidance.successMetrics.length > 0);
});

test('rejects unknown experiments', async () => {
  const advice = await getAdvice();

  assert.throws(
    () => new GrowthDraftPreparer().prepare(
      advice,
      'nonexistent-experiment',
      'reel'
    ),
    /Experiment not found/
  );
});

test('rejects invalid content types', async () => {
  const advice = await getAdvice();

  assert.throws(
    () => new GrowthDraftPreparer().prepare(
      advice,
      'repeat-top-content-pattern',
      'invalid-type'
    ),
    /Invalid draft type/
  );
});

test('prepares a second experiment independently', async () => {
  const advice = await getAdvice();

  const prepared = new GrowthDraftPreparer().prepare(
    advice,
    'reel-format-experiment',
    'reel'
  );

  assert.equal(prepared.experimentId, 'reel-format-experiment');
  assert.equal(prepared.saved, false);
  assert.ok(prepared.draft.caption.length <= 2200);
});
