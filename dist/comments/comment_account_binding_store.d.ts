import { AccountStore } from '../accounts/account_store.js';
export interface CommentAccountBinding {
    accountId: string;
    providerAccountId: string;
    providerSource: 'mock';
    createdAt: string;
}
export declare class CommentAccountBindingStore {
    private readonly accounts;
    private readonly directory;
    constructor(accounts: AccountStore, directory?: string);
    private hash;
    private pathFor;
    get(ownerId: string, accountId: string): Promise<CommentAccountBinding | null>;
    bindMock(ownerId: string, accountId: string, providerAccountId: string): Promise<CommentAccountBinding>;
}
