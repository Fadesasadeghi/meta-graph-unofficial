import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DirectMessageAdvisor
} from '../dist/direct/direct_message_advisor.js';

import {
  DirectAutoReplyPolicy,
  DEFAULT_DIRECT_REPLY_POLICY
} from '../dist/direct/direct_auto_reply_policy.js';

const advisor = new DirectMessageAdvisor();
const policy = new DirectAutoReplyPolicy();

const templates = {
  compliment: 'ممنون از محبت شما! 💛',
  pricing: 'لطفاً مدل محصول رو بفرستید.',
  product_question: 'لطفاً نام محصول رو بفرستید.'
};

function decide(
  text,
  enabled = true,
  approved = templates,
  accountPolicy = DEFAULT_DIRECT_REPLY_POLICY
) {
  const suggestion = advisor.suggest({
    messageId: 'test-message',
    conversationId: 'test-conversation',
    text
  });

  return policy.decide(
    suggestion,
    accountPolicy,
    enabled,
    approved
  );
}

test('auto replies are disabled by default', () => {
  const result = decide(
    'محصولاتتون خیلی عالیه!',
    false
  );

  assert.equal(result.mode, 'manual');
  assert.equal(result.executed, false);
});

test('approved compliments may use auto mode', () => {
  const result = decide('محصولاتتون خیلی عالیه!');

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.compliment);
  assert.equal(result.requiresApproval, false);
});

test('pricing uses approved template without inventing prices', () => {
  const result = decide('قیمت این محصول چقدره؟');

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.pricing);
});

test('product questions use approved templates', () => {
  const result = decide('این محصول موجوده؟');

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.product_question);
});

test('missing template requires manual approval', () => {
  const result = decide(
    'قیمت این محصول چقدره؟',
    true,
    {}
  );

  assert.equal(result.mode, 'manual');
  assert.equal(result.requiresApproval, true);
});

test('order support always requires human review', () => {
  const result = decide('سفارشم هنوز نرسیده.');

  assert.equal(result.mode, 'manual');
  assert.equal(result.reply, null);
});

test('complaints always require human review', () => {
  const result = decide('محصول خراب بود.');

  assert.equal(result.mode, 'manual');
});

test('spam is skipped', () => {
  const result = decide('خرید فالوور تضمینی!');

  assert.equal(result.mode, 'skip');
  assert.equal(result.reply, null);
});

test('ambiguous messages are never automatic', () => {
  const result = decide(
    'عالیه ولی سفارشم هنوز نرسیده.'
  );

  assert.equal(result.mode, 'manual');
});

test('account policy can disable auto replies for a category', () => {
  const result = decide(
    'قیمت این محصول چقدره؟',
    true,
    templates,
    {
      ...DEFAULT_DIRECT_REPLY_POLICY,
      pricing: 'manual'
    }
  );

  assert.equal(result.mode, 'manual');
});

test('unsafe policy overrides cannot automate complaints', () => {
  const result = decide(
    'این محصول خراب بود.',
    true,
    templates,
    {
      ...DEFAULT_DIRECT_REPLY_POLICY,
      complaint: 'auto'
    }
  );

  assert.equal(result.mode, 'manual');
});
