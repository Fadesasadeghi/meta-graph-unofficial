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
  const result = suggest('خیلی عالی و زیبا بود!');

  assert.equal(result.category, 'compliment');
  assert.equal(result.shouldReply, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.source, 'rule-based');
  assert.ok(result.suggestedReply);
});

test('does not invent prices', () => {
  const result = suggest('قیمت این محصول چقدره؟');

  assert.equal(result.category, 'pricing');
  assert.equal(result.shouldReply, true);
  assert.ok(result.suggestedReply.includes('بررسی'));
  assert.ok(!/\d{4,}/.test(result.suggestedReply));
});

test('does not invent product information', () => {
  const result = suggest('این محصول چه سایزی موجوده؟');

  assert.equal(result.category, 'product_question');
  assert.equal(result.shouldReply, true);
  assert.ok(result.suggestedReply.includes('بررسی'));
});

test('handles complaints cautiously', () => {
  const result = suggest('محصول خراب بود و ناراضی هستم');

  assert.equal(result.category, 'complaint');
  assert.equal(result.requiresApproval, true);
  assert.ok(result.suggestedReply.includes('بررسی'));
});

test('does not suggest replies to spam', () => {
  const result = suggest(
    'فالوور رایگان! https://example.com'
  );

  assert.equal(result.category, 'spam');
  assert.equal(result.shouldReply, false);
  assert.equal(result.suggestedReply, null);
});

test('uses a cautious fallback for unknown comments', () => {
  const result = suggest('سلام، یه سؤال داشتم');

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
    'محصول خیلی زیباست ولی خراب به دستم رسید'
  );

  assert.equal(result.category, 'complaint');
});
