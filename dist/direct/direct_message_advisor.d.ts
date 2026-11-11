export type DirectMessageCategory = 'compliment' | 'pricing' | 'product_question' | 'order_support' | 'complaint' | 'spam' | 'general';
export type DirectMessageHandling = 'template_candidate' | 'manual' | 'skip';
export interface DirectMessageSuggestion {
    messageId: string;
    conversationId: string;
    category: DirectMessageCategory;
    handling: DirectMessageHandling;
    confidence: 'low' | 'medium';
    suggestedReply: string | null;
    reason: string;
    executed: false;
}
export declare class DirectMessageAdvisor {
    suggest(input: {
        messageId: string;
        conversationId: string;
        text: string;
    }): DirectMessageSuggestion;
}
