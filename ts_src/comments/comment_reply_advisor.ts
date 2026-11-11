export type CommentCategory =
  | 'compliment'
  | 'pricing'
  | 'product_question'
  | 'complaint'
  | 'spam'
  | 'general';

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

export class CommentReplyAdvisor {
  suggest(input: CommentReplyInput): CommentReplySuggestion {
    if (
      typeof input?.commentId !== 'string' ||
      !input.commentId.trim() ||
      typeof input.text !== 'string' ||
      !input.text.trim()
    ) {
      throw new Error('Valid comment ID and text are required.');
    }

    const text = input.text.trim().toLowerCase();

    const matches = (patterns: RegExp[]) =>
      patterns.some(pattern => pattern.test(text));

    let category: CommentCategory = 'general';
    let suggestedReply: string | null =
      'Thanks for sharing your feedback with us.';
    let reason = 'General comment; a cautious reply is suggested.';
    let confidence: 'low' | 'medium' = 'low';

    if (
      matches([
        /https?:\/\/|www\./,
        /(?:t\.me|wa\.me)\//,
        /free followers|guaranteed income|free promotion|dm for collab/
      ])
    ) {
      category = 'spam';
      suggestedReply = null;
      reason = 'Potential spam or unsolicited promotion.';
      confidence = 'medium';
    } else if (
      matches([
        /complaint|broken|wrong|terrible|late|disappointed|refund|problem/
      ])
    ) {
      category = 'complaint';
      suggestedReply =
        'We are sorry to hear that. Please contact us through our official support channel so we can review the issue.';
      reason = 'Complaint detected; avoid unverified promises.';
      confidence = 'medium';
    } else if (
      matches([
        /beautiful|amazing|love it|thank you|great content|nice post|awesome|well done/
      ]) &&
      matches([
        /\b(?:but|however|although)\b/
      ])
    ) {
      category = 'general';
      suggestedReply =
        'Thanks for the feedback. Please share a bit more detail so we can review it carefully.';
      reason = 'Mixed feedback requires human review.';
      confidence = 'low';
    } else if (
      matches([
        /price|cost|how much|pricing/
      ])
    ) {
      category = 'pricing';
      suggestedReply =
        'Thanks for your question. Please tell us which item you mean so we can check the exact price.';
      reason = 'Pricing question; do not fabricate prices.';
      confidence = 'medium';
    } else if (
      matches([
        /product|size|color|available|quality|material/
      ])
    ) {
      category = 'product_question';
      suggestedReply =
        'Thanks for your question. Please tell us which product you mean so we can check the details for you.';
      reason = 'Product question; details require verification.';
      confidence = 'medium';
    } else if (
      matches([
        /beautiful|amazing|love it|thank you|great content|nice post|awesome|well done/
      ])
    ) {
      category = 'compliment';
      suggestedReply =
        'Thank you so much. We are glad you liked it.';
      reason = 'Positive feedback detected.';
      confidence = 'medium';
    }

    return {
      commentId: input.commentId,
      category,
      suggestedReply,
      confidence,
      requiresApproval: true,
      shouldReply: category !== 'spam',
      reason,
      source: 'rule-based'
    };
  }
}
