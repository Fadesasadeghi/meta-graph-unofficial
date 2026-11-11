import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DirectMessageAdvisor
} from '../dist/direct/direct_message_advisor.js';

import {
  MockDirectInboxProvider
} from '../dist/providers/mock_direct_inbox_provider.js';

const advisor = new DirectMessageAdvisor();
const inbox = new MockDirectInboxProvider();

async function analyze(conversationId) {
  const result = await inbox.listDirectMessages(
    'demo-account-1',
    conversationId
  );

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Mock inbox unavailable.');

  const message = result.data[0];

  return advisor.suggest({
    messageId: message.id,
    conversationId: message.conversationId,
    text: message.text
  });
}

function classify(text) {
  return advisor.suggest({
    messageId: 'test-message',
    conversationId: 'test-conversation',
    text
  });
}

test('classifies pricing inquiries without inventing prices', async () => {
  const result = await analyze('demo-dm-pricing');

  assert.equal(result.category, 'pricing');
  assert.equal(result.handling, 'template_candidate');
  assert.equal(result.executed, false);
  assert.doesNotMatch(result.suggestedReply, /\d+\s*تومان/);
});

test('classifies compliments', async () => {
  const result = await analyze('demo-dm-compliment');

  assert.equal(result.category, 'compliment');
  assert.equal(result.handling, 'template_candidate');
});

test('routes order support to a human', async () => {
  const result = await analyze('demo-dm-order');

  assert.equal(result.category, 'order_support');
  assert.equal(result.handling, 'manual');
  assert.equal(result.suggestedReply, null);
});

test('skips promotional spam', async () => {
  const result = await analyze('demo-dm-spam');

  assert.equal(result.category, 'spam');
  assert.equal(result.handling, 'skip');
});

test('routes complaints to a human', () => {
  const result = classify('محصولی که فرستادید خراب بود.');

  assert.equal(result.category, 'complaint');
  assert.equal(result.handling, 'manual');
});

test('routes mixed feedback to a human', () => {
  const result = classify(
    'Beautiful product but I am disappointed.'
  );

  assert.equal(result.handling, 'manual');
});

test('routes unknown messages to a human', () => {
  const result = classify('سلام، یه سوال دارم.');

  assert.equal(result.category, 'general');
  assert.equal(result.handling, 'manual');
});

test('rejects invalid input', () => {
  assert.throws(
    () => classify('  '),
    /Valid message identifiers and text/
  );
});
