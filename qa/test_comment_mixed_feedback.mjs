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
  compliment: 'Thank you for your kindness!',
  pricing: 'Please specify the product model.',
  product_question: 'Please specify the product name.'
};

function evaluate(text) {
  const suggestion = advisor.suggest({
    commentId: 'test-comment',
    text
  });

  return {
    suggestion,
    decision: policy.decide(
      suggestion,
      DEFAULT_REPLY_POLICY,
      true,
      templates
    )
  };
}

test('English mixed feedback requires manual review', () => {
  const result = evaluate(
    'Great content, but I never received my order.'
  );

  assert.equal(result.decision.mode, 'manual');
  assert.equal(result.suggestion.confidence, 'low');
});

test('Persian mixed feedback requires manual review', () => {
  const result = evaluate(
    'Amazing product but my order has not arrived.'
  );

  assert.equal(result.decision.mode, 'manual');
});

test('mixed praise and pricing requires manual review', () => {
  const result = evaluate(
    'Amazing product but why is the price so high?'
  );

  assert.equal(result.decision.mode, 'manual');
});

test('clear compliments remain eligible for auto reply', () => {
  const result = evaluate('Great content!');

  assert.equal(result.decision.mode, 'auto');
});

test('clear pricing questions remain eligible for auto reply', () => {
  const result = evaluate('How much does this item cost?');

  assert.equal(result.decision.mode, 'auto');
});

test('explicit complaints retain priority', () => {
  const result = evaluate(
    'Beautiful but the product arrived broken.'
  );

  assert.equal(result.suggestion.category, 'complaint');
  assert.equal(result.decision.mode, 'manual');
});
