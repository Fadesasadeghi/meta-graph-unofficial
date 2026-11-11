import { VerifiedCommentReplyService } from './verified_comment_reply_service.js';
export interface AutoCommentExecutionResult {
    accountId: string;
    providerAccountId: string;
    commentId: string;
    status: 'completed' | 'blocked';
    simulated: true;
    resultId: string | null;
    reason: string;
    executedAt: string | null;
}
export declare class MockAutoCommentExecutor {
    private readonly verifiedReplies;
    private readonly directory;
    private readonly provider;
    constructor(verifiedReplies: VerifiedCommentReplyService, directory?: string);
    private hash;
    execute(ownerId: string, accountId: string, mediaId: string, commentId: string): Promise<AutoCommentExecutionResult>;
}
