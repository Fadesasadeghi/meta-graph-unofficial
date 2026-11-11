import type {
  ProviderResult
} from './instagram_provider.js';

import type {
  InstagramDirectMessage
} from './instagram_action_provider.js';

export class MockDirectInboxProvider {
  readonly source = 'mock' as const;

  private readonly accountId = 'demo-account-1';

  private readonly conversations: Record<
    string,
    InstagramDirectMessage[]
  > = {
    'demo-dm-pricing': [
      {
        id: 'demo-message-pricing-1',
        conversationId: 'demo-dm-pricing',
        senderId: 'demo-customer-1',
        text: 'Hi, how much is this item?',
        createdAt: '2026-11-10T09:00:00.000Z'
      }
    ],

    'demo-dm-compliment': [
      {
        id: 'demo-message-compliment-1',
        conversationId: 'demo-dm-compliment',
        senderId: 'demo-customer-2',
        text: 'Your products look amazing. Thanks!',
        createdAt: '2026-11-10T09:15:00.000Z'
      }
    ],

    'demo-dm-order': [
      {
        id: 'demo-message-order-1',
        conversationId: 'demo-dm-order',
        senderId: 'demo-customer-3',
        text: 'My order has still not arrived. Please follow up.',
        createdAt: '2026-11-10T09:30:00.000Z'
      }
    ],

    'demo-dm-spam': [
      {
        id: 'demo-message-spam-1',
        conversationId: 'demo-dm-spam',
        senderId: 'demo-spammer-1',
        text: 'Free followers and guaranteed promotion. Buy now.',
        createdAt: '2026-11-10T09:45:00.000Z'
      }
    ]
  };

  private success<T>(data: T): ProviderResult<T> {
    return {
      ok: true,
      data,
      source: 'mock',
      fetchedAt: new Date().toISOString()
    };
  }

  private failure<T>(
    code: 'INVALID_REQUEST' | 'NOT_FOUND',
    message: string
  ): ProviderResult<T> {
    return {
      ok: false,
      source: 'mock',
      error: {
        code,
        message,
        retryable: false
      }
    };
  }

  async listConversationIds(
    accountId: string
  ): Promise<ProviderResult<string[]>> {
    if (
      typeof accountId !== 'string' ||
      !accountId.trim()
    ) {
      return this.failure(
        'INVALID_REQUEST',
        'Valid accountId is required.'
      );
    }

    if (accountId !== this.accountId) {
      return this.failure(
        'NOT_FOUND',
        'Mock account not found.'
      );
    }

    return this.success(
      Object.keys(this.conversations)
    );
  }

  async listDirectMessages(
    accountId: string,
    conversationId: string
  ): Promise<ProviderResult<InstagramDirectMessage[]>> {
    if (
      typeof accountId !== 'string' ||
      !accountId.trim() ||
      typeof conversationId !== 'string' ||
      !conversationId.trim()
    ) {
      return this.failure(
        'INVALID_REQUEST',
        'Valid accountId and conversationId are required.'
      );
    }

    if (accountId !== this.accountId) {
      return this.failure(
        'NOT_FOUND',
        'Mock account not found.'
      );
    }

    const messages = this.conversations[conversationId];

    if (!messages) {
      return this.failure(
        'NOT_FOUND',
        'Mock conversation not found.'
      );
    }

    return this.success(
      messages.map(message => ({ ...message }))
    );
  }
}
