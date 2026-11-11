import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CommentReplyAdvisor
} from '../dist/comments/comment_reply_advisor.js';

import {
  CommentAutoReplyPolicy,
  DEFAULT_REPLY_POLICY
} from '../dist/comments/comment_auto_reply_policy.js';

const advisor = new CommentReplyAdvisor();
const policy = new CommentAutoReplyPolicy();

const templates = {
  compliment: 'خیلی ممنون از محبتت 💛',
  pricing: 'لطفاً مدل محصول رو مشخص کن تا قیمت بررسی بشه.',
  product_question: 'لطفاً محصول موردنظرت رو مشخص کن.'
};

function decide(text, enabled = false, approved = templates) {
  const suggestion = advisor.suggest({
    commentId: 'comment-1',
    text
  });

  return policy.decide(
    suggestion,
    DEFAULT_REPLY_POLICY,
    enabled,
    approved
  );
}

test('automatic replies are disabled by default', () => {
  const result = decide('خیلی عالی بود!');

  assert.equal(result.mode, 'manual');
});

test('pre-approved compliments can use auto mode', () => {
  const result = decide('چقدر زیبا بود!', true);

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.compliment);
});

test('pricing uses an approved generic template', () => {
  const result = decide('قیمت این محصول چقدره؟', true);

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.pricing);
});

test('product questions use approved templates', () => {
  const result = decide('این محصول چه سایزی موجوده؟', true);

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.product_question);
});

test('missing approved template requires manual review', () => {
  const result = decide('قیمت چنده؟', true, {
    compliment: templates.compliment
  });

  assert.equal(result.mode, 'manual');
});

test('complaints always require manual approval', () => {
  const result = decide(
    'محصول خراب بود و ناراضی هستم',
    true
  );

  assert.equal(result.mode, 'manual');
});

test('spam is skipped even when auto mode is enabled', () => {
  const result = decide(
    'فالوور رایگان https://example.com',
    true
  );

  assert.equal(result.mode, 'skip');
  assert.equal(result.reply, null);
});

test('ambiguous comments require manual approval', () => {
  const result = decide('سلام یه سؤال داشتم', true);

  assert.equal(result.mode, 'manual');
});

test('low-confidence suggestions do not auto-reply', () => {
  const suggestion = advisor.suggest({
    commentId: 'comment-1',
    text: 'خیلی عالی بود!'
  });

  suggestion.confidence = 'low';

  const result = policy.decide(
    suggestion,
    DEFAULT_REPLY_POLICY,
    true,
    templates
  );

  assert.equal(result.mode, 'manual');
});
