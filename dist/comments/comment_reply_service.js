import { CommentReplyAdvisor } from './comment_reply_advisor.js';
import { CommentAutoReplyPolicy } from './comment_auto_reply_policy.js';
export class CommentReplyService {
    settingsStore;
    advisor = new CommentReplyAdvisor();
    policy = new CommentAutoReplyPolicy();
    constructor(settingsStore) {
        this.settingsStore = settingsStore;
    }
    async preview(ownerId, accountId, comment) {
        if (typeof ownerId !== 'string' ||
            !ownerId.trim() ||
            typeof accountId !== 'string' ||
            !accountId.trim()) {
            throw new Error('Valid owner and account IDs required.');
        }
        // Enforce account ownership before evaluating any comment.
        const settings = await this.settingsStore.get(ownerId, accountId);
        const suggestion = this.advisor.suggest(comment);
        const decision = this.policy.decide(suggestion, settings.policy, settings.autoReplyEnabled, settings.approvedTemplates);
        return {
            accountId,
            commentId: comment.commentId,
            category: suggestion.category,
            confidence: suggestion.confidence,
            mode: decision.mode,
            suggestedReply: decision.reply,
            reason: decision.reason,
            autoReplyEnabled: settings.autoReplyEnabled,
            requiresApproval: decision.mode === 'manual',
            executed: false,
            source: 'rule-based'
        };
    }
}
