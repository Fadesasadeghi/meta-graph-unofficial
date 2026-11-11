import { CommentAccountBindingStore } from './comment_account_binding_store.js';
import { VerifiedCommentLookup } from './verified_comment_lookup.js';
import { CommentReplyService } from './comment_reply_service.js';
export declare class VerifiedCommentReplyService {
    private readonly bindings;
    private readonly lookup;
    private readonly replies;
    constructor(bindings: CommentAccountBindingStore, lookup: VerifiedCommentLookup, replies: CommentReplyService);
    preview(ownerId: string, accountId: string, mediaId: string, commentId: string): Promise<{
        accountId: string;
        commentId: string;
        category: import("./comment_reply_advisor.js").CommentCategory;
        confidence: "low" | "medium";
        mode: import("./comment_auto_reply_policy.js").ReplyMode;
        suggestedReply: string | null;
        reason: string;
        autoReplyEnabled: boolean;
        requiresApproval: boolean;
        source: 'rule-based';
        mediaId: string;
        providerAccountId: string;
        commentText: string;
        commentUsername: string | null;
        providerSource: 'mock';
        simulated: true;
        executed: false;
        message: string;
    }>;
}
