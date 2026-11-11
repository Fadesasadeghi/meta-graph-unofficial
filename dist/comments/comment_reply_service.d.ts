import { type CommentReplyInput } from './comment_reply_advisor.js';
import { CommentReplySettingsStore } from './comment_reply_settings_store.js';
export declare class CommentReplyService {
    private readonly settingsStore;
    private readonly advisor;
    private readonly policy;
    constructor(settingsStore: CommentReplySettingsStore);
    preview(ownerId: string, accountId: string, comment: CommentReplyInput): Promise<{
        accountId: string;
        commentId: string;
        category: import("./comment_reply_advisor.js").CommentCategory;
        confidence: "low" | "medium";
        mode: import("./comment_auto_reply_policy.js").ReplyMode;
        suggestedReply: string | null;
        reason: string;
        autoReplyEnabled: boolean;
        requiresApproval: boolean;
        executed: boolean;
        source: 'rule-based';
    }>;
}
