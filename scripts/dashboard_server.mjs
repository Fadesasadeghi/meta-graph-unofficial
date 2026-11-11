import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { AccountStore } from '../dist/accounts/account_store.js';
import { CommentAccountBindingStore } from '../dist/comments/comment_account_binding_store.js';
import { MockDirectInboxProvider } from '../dist/providers/mock_direct_inbox_provider.js';
import { DirectReplySettingsStore } from '../dist/direct/direct_reply_settings_store.js';
import { VerifiedDirectReplyService } from '../dist/direct/verified_direct_reply_service.js';

import { MockAutoDirectExecutor } from '../dist/direct/mock_auto_direct_executor.js';
import { DEFAULT_DIRECT_REPLY_POLICY } from '../dist/direct/direct_auto_reply_policy.js';


import { MockInstagramProvider } from '../dist/providers/mock_instagram_provider.js';
import { CommentReplySettingsStore } from '../dist/comments/comment_reply_settings_store.js';
import { CommentReplyService } from '../dist/comments/comment_reply_service.js';


const HOST = '127.0.0.1';
const PORT = Number(process.env.DASHBOARD_PORT || 4173);
const ROOT = join(process.cwd(), 'dashboard');
const OWNER = 'dashboard-demo-owner';

const temporaryRoot = await mkdtemp(
  join(tmpdir(), 'hermes-dashboard-')
);

const accounts = new AccountStore(join(temporaryRoot, 'accounts'));
const bindings = new CommentAccountBindingStore(
  accounts,
  join(temporaryRoot, 'bindings')
);
const settings = new DirectReplySettingsStore(
  accounts,
  join(temporaryRoot, 'settings')
);
const inbox = new MockDirectInboxProvider();

const account = await accounts.create({
  ownerId: OWNER,
  username: 'hermes.demo',
  accountType: 'business'
});

await bindings.bindMock(OWNER, account.id, 'demo-account-1');

const verified = new VerifiedDirectReplyService(
  bindings,
  inbox,
  settings
);


// Hermes interactive mock execution
const executor = new MockAutoDirectExecutor(
  verified,
  join(temporaryRoot, 'executions')
);
const executionReceipts = new Map();

const routes = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8']
};

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const json = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(data));
  };

  if (!['GET', 'POST'].includes(req.method)) {
    return json(405, { error: 'Method not allowed' });
  }

  const pathname = new URL(
    req.url || '/',
    `http://${HOST}:${PORT}`
  ).pathname;


  if (pathname === '/api/demo/executions' && req.method === 'GET') {
    return json(200, {
      source: 'mock',
      items: [...executionReceipts.values()]
    });
  }

  if (pathname === '/api/demo/execute-pricing' && req.method === 'POST') {
    const origin = req.headers.origin;
    const expectedOrigin = `http://${HOST}:${PORT}`;

    if (origin !== expectedOrigin) {
      return json(403, { error: 'Invalid request origin' });
    }

    if (!req.headers['content-type']?.startsWith('application/json')) {
      return json(415, { error: 'JSON content required' });
    }

    let body = '';

    try {
      for await (const chunk of req) {
        body += chunk.toString();

        if (body.length > 1024) {
          return json(413, { error: 'Request too large' });
        }
      }

      const input = JSON.parse(body);

      if (
        !input ||
        input.confirm !== true ||
        input.messageId !== 'demo-message-pricing-1'
      ) {
        return json(400, { error: 'Invalid demo confirmation' });
      }

      await settings.save(OWNER, account.id, {
        autoReplyEnabled: true,
        policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
        approvedTemplates: {
          pricing: 'Thanks for your message. Please tell us which item you mean so we can check the exact price.'
        }
      });

      const receipt = await executor.execute(
        OWNER,
        account.id,
        'demo-dm-pricing',
        'demo-message-pricing-1'
      );

      if (receipt.simulated !== true) {
        throw new Error('Unexpected non-mock result');
      }

      executionReceipts.set(receipt.messageId, receipt);

      return json(200, {
        source: 'mock',
        receipt
      });
    } catch (error) {
      if (
        error instanceof Error &&
        /reconciliation required/i.test(error.message)
      ) {
        return json(409, {
          error: 'Execution status is uncertain; reconciliation required.'
        });
      }

      console.error('Mock execution error:', error);
      return json(500, {
        error: 'Mock execution failed; check server logs'
      });
    }
  }

  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  if (pathname === '/api/health') {
    return json(200, {
      ok: true,
      mode: 'mock',
      backendConnected: true
    });
  }

  if (pathname === '/api/demo/inbox') {
    try {
      const conversations = await inbox.listConversationIds(
        'demo-account-1'
      );

      if (!conversations.ok) {
        return json(503, { error: 'Mock inbox unavailable' });
      }

      const items = [];

      for (const conversationId of conversations.data) {
        const messages = await inbox.listDirectMessages(
          'demo-account-1',
          conversationId
        );

        if (!messages.ok) {
          return json(503, { error: 'Mock messages unavailable' });
        }

        for (const message of messages.data) {
          const preview = await verified.preview(
            OWNER,
            account.id,
            conversationId,
            message.id
          );

          items.push({
            id: message.id,
            conversationId,
            senderId: message.senderId,
            text: message.text,
            createdAt: message.createdAt,
            category: preview.category,
            mode: preview.mode,
            confidence: preview.confidence,
            suggestedReply: preview.reply,
            reason: preview.reason,
            simulated: true
          });
        }
      }

      return json(200, {
        source: 'mock',
        autoReplyEnabled: false,
        count: items.length,
        items
      });
    } catch (error) {
      console.error('Inbox error:', error);
      return json(500, { error: 'Unable to load demo inbox' });
    }
  }


  if (pathname === '/api/demo/comments') {
    try {
      const binding = await bindings.get(OWNER, account.id);

      if (
        !binding ||
        binding.providerSource !== 'mock' ||
        binding.providerAccountId !== 'demo-account-1'
      ) {
        return json(403, { error: 'Verified MOCK binding required' });
      }

      const provider = new MockInstagramProvider();

      const service = new CommentReplyService(
        new CommentReplySettingsStore(
          accounts,
          join(temporaryRoot, 'comment-settings')
        )
      );

      const items = [];

      for (const mediaId of [
        'demo-post-1',
        'demo-post-2',
        'demo-post-3'
      ]) {
        const result = await provider.listComments(
          binding.providerAccountId,
          mediaId
        );

        if (!result.ok || result.source !== 'mock') {
          return json(503, {
            error: 'Verified MOCK comments unavailable'
          });
        }

        for (const comment of result.data.items) {
          const preview = await service.preview(
            OWNER,
            account.id,
            {
              commentId: comment.id,
              text: comment.text
            }
          );

          items.push({
            id: comment.id,
            mediaId,
            text: comment.text,
            category: preview.category,
            confidence: preview.confidence,
            mode: preview.mode,
            suggestedReply: preview.suggestedReply,
            reason: preview.reason,
            autoReplyEnabled: preview.autoReplyEnabled,
            executed: false,
            simulated: true
          });
        }
      }

      return json(200, {
        source: 'mock',
        count: items.length,
        items,
        autoReplyEnabled: false
      });
    } catch (error) {
      console.error('Dashboard comments error:', error);
      return json(500, {
        error: 'Unable to load demo comments'
      });
    }
  }

  const route = routes[pathname];

  if (!route) {
    return json(404, { error: 'Not found' });
  }

  try {
    const [filename, type] = route;
    const contents = await readFile(join(ROOT, filename));

    res.writeHead(200, { 'Content-Type': type });
    res.end(contents);
  } catch {
    return json(500, { error: 'Dashboard asset unavailable' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dashboard: http://${HOST}:${PORT}`);
  console.log('Verified MOCK Inbox: connected');
  console.log('Real Instagram messaging: disabled');
});

async function shutdown() {
  server.close();
  await rm(temporaryRoot, {
    recursive: true,
    force: true
  });
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
