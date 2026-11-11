export class MockDirectInboxProvider {
    source = 'mock';
    accountId = 'demo-account-1';
    conversations = {
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
    validId(value) {
        return typeof value === 'string' &&
            value.trim().length > 0;
    }
    success(data) {
        return {
            ok: true,
            data,
            source: 'mock',
            fetchedAt: new Date().toISOString()
        };
    }
    failure(code, message) {
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
    async listConversationIds(accountId) {
        if (!this.validId(accountId)) {
            return this.failure('INVALID_REQUEST', 'Valid accountId is required.');
        }
        if (accountId !== this.accountId) {
            return this.failure('NOT_FOUND', 'Mock account not found.');
        }
        return this.success(Object.keys(this.conversations));
    }
    async listDirectMessages(accountId, conversationId) {
        if (!this.validId(accountId) ||
            !this.validId(conversationId)) {
            return this.failure('INVALID_REQUEST', 'Valid accountId and conversationId are required.');
        }
        if (accountId !== this.accountId) {
            return this.failure('NOT_FOUND', 'Mock account not found.');
        }
        const messages = this.conversations[conversationId];
        if (!messages) {
            return this.failure('NOT_FOUND', 'Mock conversation not found.');
        }
        // Return copies so callers cannot modify the mock dataset.
        return this.success(messages.map(message => ({ ...message })));
    }
}
