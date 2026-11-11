import type {
  DirectMessageCategory,
  DirectMessageSuggestion
} from './direct_message_advisor.js';

export type DirectReplyMode = 'auto' | 'manual' | 'skip';

export type DirectReplyPolicy = Record<
  DirectMessageCategory,
  DirectReplyMode
>;

export type DirectApprovedTemplates = Partial<
  Record<DirectMessageCategory, string>
>;

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

export const DEFAULT_DIRECT_REPLY_POLICY: DirectReplyPolicy = {
  compliment: 'auto',
  pricing: 'auto',
  product_question: 'auto',
  order_support: 'manual',
  complaint: 'manual',
  spam: 'skip',
  general: 'manual'
};

const SAFE_AUTO_CATEGORIES = new Set<DirectMessageCategory>([
  'compliment',
  'pricing',
  'product_question'
]);

export class DirectAutoReplyPolicy {
  decide(
    suggestion: DirectMessageSuggestion,
    policy: DirectReplyPolicy = DEFAULT_DIRECT_REPLY_POLICY,
    autoReplyEnabled = false,
    approvedTemplates: DirectApprovedTemplates = {}
  ): DirectReplyDecision {
    const category = suggestion.category;

    const manual = (reason: string): DirectReplyDecision => ({
      messageId: suggestion.messageId,
      conversationId: suggestion.conversationId,
      category,
      mode: 'manual',
      reply: suggestion.suggestedReply,
      reason,
      requiresApproval: true,
      executed: false
    });

    if (category === 'spam' || suggestion.handling === 'skip') {
      return {
        messageId: suggestion.messageId,
        conversationId: suggestion.conversationId,
        category,
        mode: 'skip',
        reply: null,
        reason: 'Spam is never answered automatically.',
        requiresApproval: false,
        executed: false
      };
    }

    if (
      !SAFE_AUTO_CATEGORIES.has(category) ||
      suggestion.handling !== 'template_candidate' ||
      suggestion.confidence !== 'medium'
    ) {
      return manual('Message requires human review.');
    }

    if (policy[category] !== 'auto') {
      return manual('Account policy requires manual approval.');
    }

    if (!autoReplyEnabled) {
      return manual('Automatic DM replies are disabled.');
    }

    const template = approvedTemplates[category];

    if (
      typeof template !== 'string' ||
      !template.trim()
    ) {
      return manual('No approved reply template is configured.');
    }

    return {
      messageId: suggestion.messageId,
      conversationId: suggestion.conversationId,
      category,
      mode: 'auto',
      reply: template.trim(),
      reason: 'Approved template selected for MOCK auto reply.',
      requiresApproval: false,
      executed: false
    };
  }
}
