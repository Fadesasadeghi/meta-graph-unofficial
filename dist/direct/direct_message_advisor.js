export class DirectMessageAdvisor {
    suggest(input) {
        if (typeof input?.messageId !== 'string' ||
            !input.messageId.trim() ||
            typeof input.conversationId !== 'string' ||
            !input.conversationId.trim() ||
            typeof input.text !== 'string' ||
            !input.text.trim()) {
            throw new Error('Valid message identifiers and text required.');
        }
        const text = input.text.trim().toLowerCase();
        const matches = (patterns) => patterns.some(pattern => pattern.test(text));
        let category = 'general';
        let handling = 'manual';
        let confidence = 'low';
        let suggestedReply = null;
        let reason = 'General inquiry requires human review.';
        if (matches([
            /https?:\/\/|www\./,
            /free followers|guaranteed promotion|buy now|limited offer/
        ])) {
            category = 'spam';
            handling = 'skip';
            confidence = 'medium';
            suggestedReply = null;
            reason = 'Potential spam or unsolicited promotion.';
        }
        else if (matches([
            /order|shipment|shipping|delivery|not arrived|tracking/
        ])) {
            category = 'order_support';
            handling = 'manual';
            confidence = 'medium';
            suggestedReply =
                null;
            reason = 'Order support requires human review.';
        }
        else if (matches([
            /complaint|broken|wrong|terrible|refund|disappointed|problem/
        ])) {
            category = 'complaint';
            handling = 'manual';
            confidence = 'medium';
            suggestedReply =
                null;
            reason = 'Complaint detected; requires human review.';
        }
        else if (matches([
            /beautiful|amazing|love it|thank you|awesome|great/
        ]) &&
            matches([
                /\b(?:but|however|although)\b/
            ])) {
            category = 'general';
            handling = 'manual';
            confidence = 'low';
            suggestedReply =
                null;
            reason = 'Mixed feedback should not be auto-replied.';
        }
        else if (matches([
            /price|cost|how much|pricing/
        ])) {
            category = 'pricing';
            handling = 'template_candidate';
            confidence = 'medium';
            suggestedReply =
                'Thanks for your message. Please tell us which item you mean so we can check the exact price.';
            reason = 'Pricing inquiry can use a verified template.';
        }
        else if (matches([
            /\b(?:size|color|available|quality|material|in stock|product details|which product)\b/
        ])) {
            category = 'product_question';
            handling = 'template_candidate';
            confidence = 'medium';
            suggestedReply =
                'Thanks for your message. Please tell us which product you mean so we can check the details for you.';
            reason = 'Product inquiry can use a verified template.';
        }
        else if (matches([
            /beautiful|amazing|love it|thank you|awesome|great/
        ])) {
            category = 'compliment';
            handling = 'template_candidate';
            confidence = 'medium';
            suggestedReply =
                'Thank you so much. We really appreciate your kind message.';
            reason = 'Positive message can use a verified template.';
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
