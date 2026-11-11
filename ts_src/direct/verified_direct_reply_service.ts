import { CommentAccountBindingStore } from '../comments/comment_account_binding_store.js';
import { MockDirectInboxProvider } from '../providers/mock_direct_inbox_provider.js';

import { DirectMessageAdvisor } from './direct_message_advisor.js';
import { DirectAutoReplyPolicy } from './direct_auto_reply_policy.js';
import { DirectReplySettingsStore } from './direct_reply_settings_store.js';

export class VerifiedDirectReplyService {
  constructor(
    private readonly bindings: CommentAccountBindingStore,
    private readonly inbox: MockDirectInboxProvider,
    private readonly settings: DirectReplySettingsStore,
    private readonly advisor = new DirectMessageAdvisor(),
    private readonly policy = new DirectAutoReplyPolicy()
  ) {}

  async preview(
    ownerId: string,
    accountId: string,
    conversationId: string,
    messageId: string
  ) {
    if (
      typeof ownerId !== 'string' ||
      !ownerId.trim() ||
      typeof accountId !== 'string' ||
      !accountId.trim() ||
      typeof conversationId !== 'string' ||
      !conversationId.trim() ||
      typeof messageId !== 'string' ||
      !messageId.trim()
    ) {
      throw new Error(
        'Valid owner, account, conversation and message IDs required.'
      );
    }

    // Confirm internal account ownership and MOCK binding.
    const binding = await this.bindings.get(
      ownerId,
      accountId
    );

    if (!binding || binding.providerSource !== 'mock') {
      throw new Error(
        'A verified MOCK account binding is required.'
      );
    }

    // The agent cannot supply arbitrary message text.
    const result = await this.inbox.listDirectMessages(
      binding.providerAccountId,
      conversationId
    );

    if (!result.ok || result.source !== 'mock') {
      throw new Error(
        'MOCK conversation could not be verified.'
      );
    }

    const matches = result.data.filter(
      message =>
        message.id === messageId &&
        message.conversationId === conversationId
    );

    if (matches.length !== 1) {
      throw new Error(
        'Message not found or ambiguous in conversation.'
      );
    }

    const message = matches[0];

    if (
      typeof message.text !== 'string' ||
      !message.text.trim() ||
      typeof message.senderId !== 'string' ||
      !message.senderId.trim()
    ) {
      throw new Error('Invalid verified message.');
    }

    const suggestion = this.advisor.suggest({
      messageId: message.id,
      conversationId: message.conversationId,
      text: message.text
    });

    const currentSettings = await this.settings.get(
      ownerId,
      accountId
    );

    const decision = this.policy.decide(
      suggestion,
      currentSettings.policy,
      currentSettings.autoReplyEnabled,
      currentSettings.approvedTemplates
    );

    return {
      ...decision,
      accountId,
      providerAccountId: binding.providerAccountId,
      senderId: message.senderId,
      messageText: message.text,
      createdAt: message.createdAt,
      confidence: suggestion.confidence,
      autoReplyEnabled: currentSettings.autoReplyEnabled,
      providerSource: 'mock' as const,
      simulated: true as const,
      executed: false as const
    };
  }
}
