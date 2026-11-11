import { AccountStore } from '../accounts/account_store.js';
export interface CommentReplyReservation {
    accountId: string;
    commentId: string;
    status: 'reserved' | 'duplicate';
    simulated: true;
}
export declare class CommentReplyReservationStore {
    private readonly accounts;
    private readonly directory;
    constructor(accounts: AccountStore, directory?: string);
    reserve(ownerId: string, accountId: string, commentId: string): Promise<CommentReplyReservation>;
}
