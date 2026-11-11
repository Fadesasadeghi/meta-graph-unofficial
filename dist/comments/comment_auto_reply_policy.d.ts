import type { CommentCategory, CommentReplySuggestion } from './comment_reply_advisor.js';
export type ReplyMode = 'auto' | 'manual' | 'skip';
export type ReplyPolicy = Record<CommentCategory, ReplyMode>;
export declare const DEFAULT_REPLY_POLICY: ReplyPolicy;
export interface ReplyDecision {
    mode: ReplyMode;
    reply: string | null;
    reason: string;
}
export declare class CommentAutoReplyPolicy {
    decide(suggestion: CommentReplySuggestion, policy?: ReplyPolicy, autoReplyEnabled?: boolean, approvedTemplates?: Partial<Record<CommentCategory, string>>): ReplyDecision;
}
