import { AccountStore } from '../accounts/account_store.js';
export type QueuedAction = {
    kind: 'publish';
    type: 'post' | 'story' | 'reel';
    mediaUrl: string;
    caption?: string;
} | {
    kind: 'comment_reply';
    commentId: string;
    text: string;
} | {
    kind: 'direct_message';
    conversationId: string;
    text: string;
};
export interface ActionQueueRecord {
    id: string;
    accountId: string;
    ownerId: string;
    idempotencyKey: string;
    action: QueuedAction;
    status: 'pending_approval';
    createdAt: string;
}
export declare class ActionQueue {
    private readonly accounts;
    private readonly directory;
    constructor(accounts: AccountStore, directory?: string);
    private accountDirectory;
    private validate;
    enqueue(ownerId: string, accountId: string, idempotencyKey: string, action: QueuedAction): Promise<ActionQueueRecord>;
    list(ownerId: string, accountId: string): Promise<ActionQueueRecord[]>;
}
