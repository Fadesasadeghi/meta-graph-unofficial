import { VerifiedDirectReplyService } from './verified_direct_reply_service.js';
export interface AutoDirectExecutionResult {
    accountId: string;
    providerAccountId: string;
    conversationId: string;
    messageId: string;
    status: 'completed' | 'blocked';
    simulated: true;
    resultId: string | null;
    reason: string;
    executedAt: string | null;
}
export declare class MockAutoDirectExecutor {
    private readonly verified;
    private readonly directory;
    private readonly provider;
    constructor(verified: VerifiedDirectReplyService, directory?: string);
    private hash;
    private validReceipt;
    execute(ownerId: string, accountId: string, conversationId: string, messageId: string): Promise<AutoDirectExecutionResult>;
}
