export type CommentCategory = 'compliment' | 'pricing' | 'product_question' | 'complaint' | 'spam' | 'general';
export interface CommentReplySuggestion {
    commentId: string;
    category: CommentCategory;
    suggestedReply: string | null;
    confidence: 'low' | 'medium';
    requiresApproval: true;
    shouldReply: boolean;
    reason: string;
    source: 'rule-based';
}
export interface CommentReplyInput {
    commentId: string;
    text: string;
}
export declare class CommentReplyAdvisor {
    suggest(input: CommentReplyInput): CommentReplySuggestion;
}
