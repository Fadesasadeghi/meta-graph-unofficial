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
        text: 'سلام، قیمت این محصول چقدره؟',
        createdAt: '2026-11-10T09:00:00.000Z'
      }
    ],

    'demo-dm-compliment': [
      {
        id: 'demo-message-compliment-1',
        conversationId: 'demo-dm-compliment',
        senderId: 'demo-customer-2',
        text: 'محصولاتتون خیلی عالیه، ممنون!',
        createdAt: '2026-11-10T09:15:00.000Z'
      }
    ],

    'demo-dm-order': [
      {
        id: 'demo-message-order-1',
        conversationId: 'demo-dm-order',
        senderId: 'demo-customer-3',
        text: 'سفارشم هنوز نرسیده، لطفاً پیگیری کنید.',
        createdAt: '2026-11-10T09:30:00.000Z'
      }
    ],

    'demo-dm-spam': [
      {
        id: 'demo-message-spam-1',
        conversationId: 'demo-dm-spam',
        senderId: 'demo-spammer-1',
        text: 'تبلیغات تضمینی فالوور! همین حالا خرید کنید.',
        createdAt: '2026-11-10T09:45:00.000Z'
      }
    ]
  };

  private validId(value: unknown): value is string {
    return typeof value === 'string' &&
      value.trim().length > 0;
  }

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
    if (!this.validId(accountId)) {
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
      !this.validId(accountId) ||
      !this.validId(conversationId)
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

    // Return copies so callers cannot modify the mock dataset.
    return this.success(
      messages.map(message => ({ ...message }))
    );
  }
}
