import {
  CommentReplyAdvisor,
  type CommentReplyInput
} from './comment_reply_advisor.js';

import {
  CommentAutoReplyPolicy
} from './comment_auto_reply_policy.js';

import {
  CommentReplySettingsStore
} from './comment_reply_settings_store.js';

export class CommentReplyService {
  private readonly advisor = new CommentReplyAdvisor();
  private readonly policy = new CommentAutoReplyPolicy();

  constructor(
    private readonly settingsStore: CommentReplySettingsStore
  ) {}

  async preview(
    ownerId: string,
    accountId: string,
    comment: CommentReplyInput
  ) {
    if (
      typeof ownerId !== 'string' ||
      !ownerId.trim() ||
      typeof accountId !== 'string' ||
      !accountId.trim()
    ) {
      throw new Error('Valid owner and account IDs required.');
    }

    // Enforce account ownership before evaluating any comment.
    const settings = await this.settingsStore.get(
      ownerId,
      accountId
    );

    const suggestion = this.advisor.suggest(comment);

    const decision = this.policy.decide(
      suggestion,
      settings.policy,
      settings.autoReplyEnabled,
      settings.approvedTemplates
    );

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
      source: 'rule-based' as const
    };
  }
}
