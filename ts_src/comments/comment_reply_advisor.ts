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
      'ممنون که نظرت رو با ما به اشتراک گذاشتی 🌷';
    let reason = 'General comment; a cautious reply is suggested.';
    let confidence: 'low' | 'medium' = 'low';

    if (
      matches([
        /https?:\/\/|www\./,
        /(?:t\.me|wa\.me)\//,
        /فالوور رایگان|درآمد تضمینی|تبلیغات رایگان/,
        /free followers|guaranteed income/
      ])
    ) {
      category = 'spam';
      suggestedReply = null;
      reason = 'Potential spam or unsolicited promotion.';
      confidence = 'medium';
    } else if (
      matches([
        /ناراضی|خراب|اشتباه|افتضاح|شکایت|دیر رسید/,
        /complaint|broken|disappointed|refund/
      ])
    ) {
      category = 'complaint';
      suggestedReply =
        'متأسفیم که تجربه خوبی نداشتی. لطفاً جزئیات رو از طریق راه ارتباطی رسمی پیج مطرح کن تا بررسی کنیم.';
      reason = 'Complaint detected; avoid unverified promises.';
      confidence = 'medium';
    } else if (
      matches([
        /عالی|قشنگ|زیبا|ممنون|مرسی|دوست داشتم/,
        /beautiful|amazing|love it|thank you|great content|nice post|awesome|well done/
      ]) &&
      matches([
        /ولی|اما|با این حال/,
        /\b(?:but|however|although)\b/
      ])
    ) {
      category = 'general';
      suggestedReply = 'ممنون که نظرت رو گفتی. لطفاً جزئیات بیشتری بده تا موضوع رو بررسی کنیم.';
      reason = 'Mixed feedback requires human review.';
      confidence = 'low';
    } else if (
      matches([
        /قیمت|چنده|چقدره|هزینه|تومن|تومان/,
        /price|cost|how much/
      ])
    ) {
      category = 'pricing';
      suggestedReply =
        'ممنون از پرسشت 🌷 لطفاً مدل یا محصول موردنظرت رو مشخص کن تا اطلاعات دقیق قیمت رو بررسی کنیم.';
      reason = 'Pricing question; do not fabricate prices.';
      confidence = 'medium';
    } else if (
      matches([
        /محصول|سایز|رنگ بندی|موجود|کیفیت|جنس/,
        /product|size|available|quality/
      ])
    ) {
      category = 'product_question';
      suggestedReply =
        'ممنون از پرسشت 🌷 لطفاً مشخص کن درباره کدوم محصول سؤال داری تا اطلاعاتش رو بررسی کنیم.';
      reason = 'Product question; details require verification.';
      confidence = 'medium';
    } else if (
      matches([
        /عالی|قشنگ|زیبا|ممنون|مرسی|دوست داشتم/,
        /beautiful|amazing|love it|thank you|great content|nice post|awesome|well done/
      ])
    ) {
      category = 'compliment';
      suggestedReply =
        'خیلی ممنون از محبتت! خوشحالیم که دوستش داشتی 💛';
      reason = 'Positive feedback detected.';
      confidence = 'medium';
    }

    return {
      commentId: input.commentId,
      category,
      suggestedReply,
      confidence,
      requiresApproval: true,
      shouldReply: suggestedReply !== null,
      reason,
      source: 'rule-based'
    };
  }
}
