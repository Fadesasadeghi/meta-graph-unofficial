import type {
  CommentCategory,
  CommentReplySuggestion
} from './comment_reply_advisor.js';

export type ReplyMode = 'auto' | 'manual' | 'skip';
export type ReplyPolicy = Record<CommentCategory, ReplyMode>;

export const DEFAULT_REPLY_POLICY: ReplyPolicy = {
  compliment: 'auto',
  pricing: 'auto',
  product_question: 'auto',
  complaint: 'manual',
  spam: 'skip',
  general: 'manual'
};

export interface ReplyDecision {
  mode: ReplyMode;
  reply: string | null;
  reason: string;
}

export class CommentAutoReplyPolicy {
  decide(
    suggestion: CommentReplySuggestion,
    policy: ReplyPolicy = DEFAULT_REPLY_POLICY,
    autoReplyEnabled = false,
    approvedTemplates: Partial<Record<CommentCategory, string>> = {}
  ): ReplyDecision {
    if (!suggestion.shouldReply || !suggestion.suggestedReply) {
      return {
        mode: 'skip',
        reply: null,
        reason: 'No suitable reply.'
      };
    }

    const mode = policy[suggestion.category];

    if (mode === 'skip') {
      return {
        mode: 'skip',
        reply: null,
        reason: 'Category is configured to skip.'
      };
    }

    if (mode !== 'auto') {
      return {
        mode: 'manual',
        reply: suggestion.suggestedReply,
        reason: 'Manual approval required.'
      };
    }

    const template = approvedTemplates[suggestion.category];

    if (
      autoReplyEnabled &&
      suggestion.confidence === 'medium' &&
      typeof template === 'string' &&
      template.trim().length > 0 &&
      ['compliment', 'pricing', 'product_question']
        .includes(suggestion.category)
    ) {
      return {
        mode: 'auto',
        reply: template,
        reason: 'Approved template eligible for automatic reply.'
      };
    }

    return {
      mode: 'manual',
      reply: suggestion.suggestedReply,
      reason: 'Automatic reply requires enabled policy and approved template.'
    };
  }
}
