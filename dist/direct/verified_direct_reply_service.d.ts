import { CommentAccountBindingStore } from '../comments/comment_account_binding_store.js';
import { MockDirectInboxProvider } from '../providers/mock_direct_inbox_provider.js';
import { DirectMessageAdvisor } from './direct_message_advisor.js';
import { DirectAutoReplyPolicy } from './direct_auto_reply_policy.js';
import { DirectReplySettingsStore } from './direct_reply_settings_store.js';
export declare class VerifiedDirectReplyService {
    private readonly bindings;
    private readonly inbox;
    private readonly settings;
    private readonly advisor;
    private readonly policy;
    constructor(bindings: CommentAccountBindingStore, inbox: MockDirectInboxProvider, settings: DirectReplySettingsStore, advisor?: DirectMessageAdvisor, policy?: DirectAutoReplyPolicy);
    preview(ownerId: string, accountId: string, conversationId: string, messageId: string): Promise<{
        messageId: string;
        conversationId: string;
        category: import("./direct_message_advisor.js").DirectMessageCategory;
        mode: import("./direct_auto_reply_policy.js").DirectReplyMode;
        reply: string | null;
        reason: string;
        requiresApproval: boolean;
        accountId: string;
        providerAccountId: string;
        senderId: string;
        messageText: string;
        createdAt: string;
        confidence: "low" | "medium";
        autoReplyEnabled: boolean;
        providerSource: 'mock';
        simulated: true;
        executed: false;
    }>;
}
