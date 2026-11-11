export type DirectMessageCategory =
  | 'compliment'
  | 'pricing'
  | 'product_question'
  | 'order_support'
  | 'complaint'
  | 'spam'
  | 'general';

export type DirectMessageHandling =
  | 'template_candidate'
  | 'manual'
  | 'skip';

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

export class DirectMessageAdvisor {
  suggest(input: {
    messageId: string;
    conversationId: string;
    text: string;
  }): DirectMessageSuggestion {
    if (
      typeof input?.messageId !== 'string' ||
      !input.messageId.trim() ||
      typeof input.conversationId !== 'string' ||
      !input.conversationId.trim() ||
      typeof input.text !== 'string' ||
      !input.text.trim()
    ) {
      throw new Error('Valid message identifiers and text required.');
    }

    const text = input.text.toLowerCase().trim();

    const matches = (patterns: RegExp[]) =>
      patterns.some(pattern => pattern.test(text));

    let category: DirectMessageCategory = 'general';
    let handling: DirectMessageHandling = 'manual';
    let confidence: 'low' | 'medium' = 'low';
    let suggestedReply: string | null = null;
    let reason = 'Unrecognized messages require human review.';

    const isSpam = matches([
      /فالوور تضمینی|خرید فالوور|تبلیغات تضمینی|افزایش فالوور/,
      /buy followers|guaranteed followers|free followers/
    ]);

    const isOrderSupport = matches([
      /سفارش|بسته|مرسوله|کد رهگیری|تحویل|نرسیده|ارسال نشده/,
      /my order|tracking number|not delivered|never received|where is my package/
    ]);

    const isComplaint = matches([
      /خراب|شکسته|معیوب|ناراضی|شکایت|افتضاح|بی کیفیت|بی‌کیفیت/,
      /broken|damaged|defective|refund|complaint|disappointed|poor quality/
    ]);

    const isPricing = matches([
      /قیمت|چنده|چقدره|هزینه|تومان|تومن/,
      /\bprice\b|how much|cost/
    ]);

    const isProductQuestion = matches([
      /موجود|سایز|رنگ بندی|رنگ‌بندی|جنس|مشخصات|اندازه/,
      /available|in stock|size|material|colors/
    ]);

    const isCompliment = matches([
      /عالی|زیبا|قشنگ|ممنون|مرسی|دوست داشتم/,
      /great content|nice|beautiful|amazing|thank you|love it|awesome/
    ]);

    const isMixed = matches([
      /ولی|اما|با این حال/,
      /\bbut\b|\bhowever\b|\balthough\b/
    ]);

    // Prioritize customer support and complaints over praise.
    if (isSpam) {
      category = 'spam';
      handling = 'skip';
      confidence = 'medium';
      reason = 'Likely promotional spam.';
    } else if (isOrderSupport) {
      category = 'order_support';
      handling = 'manual';
      confidence = 'medium';
      reason = 'Order support requires human verification.';
    } else if (isComplaint) {
      category = 'complaint';
      handling = 'manual';
      confidence = 'medium';
      reason = 'Complaints require human review.';
    } else if (isMixed && (isCompliment || isPricing || isProductQuestion)) {
      category = 'general';
      handling = 'manual';
      confidence = 'low';
      reason = 'Mixed or ambiguous message requires human review.';
    } else if (isPricing) {
      category = 'pricing';
      handling = 'template_candidate';
      confidence = 'medium';
      suggestedReply =
        'سلام! لطفاً نام یا مدل محصول رو بفرستید تا قیمت دقیق بررسی بشه.';
      reason = 'Pricing inquiry; no price is invented.';
    } else if (isProductQuestion) {
      category = 'product_question';
      handling = 'template_candidate';
      confidence = 'medium';
      suggestedReply =
        'سلام! لطفاً نام محصول رو بفرستید تا اطلاعات دقیق‌تری ارائه بشه.';
      reason = 'Product inquiry; no product facts are invented.';
    } else if (isCompliment) {
      category = 'compliment';
      handling = 'template_candidate';
      confidence = 'medium';
      suggestedReply = 'خیلی ممنون از محبت و همراهی شما! 💛';
      reason = 'Positive feedback.';
    }

    return {
      messageId: input.messageId,
      conversationId: input.conversationId,
      category,
      handling,
      confidence,
      suggestedReply,
      reason,
      executed: false
    };
  }
}
