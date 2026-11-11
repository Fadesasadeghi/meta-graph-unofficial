export const DEFAULT_REPLY_POLICY = {
    compliment: 'auto',
    pricing: 'auto',
    product_question: 'auto',
    complaint: 'manual',
    spam: 'skip',
    general: 'manual'
};
export class CommentAutoReplyPolicy {
    decide(suggestion, policy = DEFAULT_REPLY_POLICY, autoReplyEnabled = false, approvedTemplates = {}) {
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
        if (autoReplyEnabled &&
            suggestion.confidence === 'medium' &&
            typeof template === 'string' &&
            template.trim().length > 0 &&
            ['compliment', 'pricing', 'product_question']
                .includes(suggestion.category)) {
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
