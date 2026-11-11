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
  compliment: 'Thank you so much for your support!',
  pricing: 'Please share the product model so we can check the price.',
  product_question: 'Please specify which product you mean.'
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
  const result = decide('Absolutely amazing!');

  assert.equal(result.mode, 'manual');
});

test('pre-approved compliments can use auto mode', () => {
  const result = decide('So beautiful!', true);

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.compliment);
});

test('pricing uses an approved generic template', () => {
  const result = decide('How much does this item cost?', true);

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.pricing);
});

test('product questions use approved templates', () => {
  const result = decide('What size is available for this product?', true);

  assert.equal(result.mode, 'auto');
  assert.equal(result.reply, templates.product_question);
});

test('missing approved template requires manual review', () => {
  const result = decide('How much does it cost?', true, {
    compliment: templates.compliment
  });

  assert.equal(result.mode, 'manual');
});

test('complaints always require manual approval', () => {
  const result = decide(
    'The item arrived broken and I am disappointed.',
    true
  );

  assert.equal(result.mode, 'manual');
});

test('spam is skipped even when auto mode is enabled', () => {
  const result = decide(
    'Free followers https://example.com',
    true
  );

  assert.equal(result.mode, 'skip');
  assert.equal(result.reply, null);
});

test('ambiguous comments require manual approval', () => {
  const result = decide('Hello, I have a question.', true);

  assert.equal(result.mode, 'manual');
});

test('low-confidence suggestions do not auto-reply', () => {
  const suggestion = advisor.suggest({
    commentId: 'comment-1',
    text: 'Absolutely amazing!'
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
