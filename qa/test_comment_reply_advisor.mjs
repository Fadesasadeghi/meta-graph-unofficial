import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CommentReplyAdvisor
} from '../dist/comments/comment_reply_advisor.js';

const advisor = new CommentReplyAdvisor();

function suggest(text, commentId = 'comment-001') {
  return advisor.suggest({ commentId, text });
}

test('suggests a friendly reply for compliments', () => {
  const result = suggest('Absolutely amazing and beautiful!');

  assert.equal(result.category, 'compliment');
  assert.equal(result.shouldReply, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.source, 'rule-based');
  assert.ok(result.suggestedReply);
});

test('does not invent prices', () => {
  const result = suggest('How much does this item cost?');

  assert.equal(result.category, 'pricing');
  assert.equal(result.shouldReply, true);
  assert.ok(/check|review/i.test(result.suggestedReply));
  assert.ok(!/\d{4,}/.test(result.suggestedReply));
});

test('does not invent product information', () => {
  const result = suggest('What size is available for this product?');

  assert.equal(result.category, 'product_question');
  assert.equal(result.shouldReply, true);
  assert.ok(/check|review/i.test(result.suggestedReply));
});

test('handles complaints cautiously', () => {
  const result = suggest('The item arrived broken and I am disappointed.');

  assert.equal(result.category, 'complaint');
  assert.equal(result.requiresApproval, true);
  assert.ok(/check|review/i.test(result.suggestedReply));
});

test('does not suggest replies to spam', () => {
  const result = suggest(
    'Free followers! https://example.com'
  );

  assert.equal(result.category, 'spam');
  assert.equal(result.shouldReply, false);
  assert.equal(result.suggestedReply, null);
});

test('uses a cautious fallback for unknown comments', () => {
  const result = suggest('Hello, I have a question.');

  assert.equal(result.category, 'general');
  assert.equal(result.confidence, 'low');
  assert.equal(result.requiresApproval, true);
});

test('rejects invalid input', () => {
  assert.throws(
    () => advisor.suggest({
      commentId: '',
      text: 'Hello'
    }),
    /Valid comment ID/
  );

  assert.throws(
    () => advisor.suggest({
      commentId: 'comment-1',
      text: '   '
    }),
    /Valid comment ID/
  );
});

test('prioritizes complaints over compliments', () => {
  const result = suggest(
    'The product looks beautiful but arrived broken.'
  );

  assert.equal(result.category, 'complaint');
});
