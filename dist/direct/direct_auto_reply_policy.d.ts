import type { DirectMessageCategory, DirectMessageSuggestion } from './direct_message_advisor.js';
export type DirectReplyMode = 'auto' | 'manual' | 'skip';
export type DirectReplyPolicy = Record<DirectMessageCategory, DirectReplyMode>;
export type DirectApprovedTemplates = Partial<Record<DirectMessageCategory, string>>;
export interface DirectReplyDecision {
    messageId: string;
    conversationId: string;
    category: DirectMessageCategory;
    mode: DirectReplyMode;
    reply: string | null;
    reason: string;
    requiresApproval: boolean;
    executed: false;
}
export declare const DEFAULT_DIRECT_REPLY_POLICY: DirectReplyPolicy;
export declare class DirectAutoReplyPolicy {
    decide(suggestion: DirectMessageSuggestion, policy?: DirectReplyPolicy, autoReplyEnabled?: boolean, approvedTemplates?: DirectApprovedTemplates): DirectReplyDecision;
}
