import { AccountStore } from './account_store.js';
import { DraftStore } from '../content/draft_store.js';
export declare class AccountDraftStore {
    private readonly directory;
    private readonly accounts;
    constructor(accounts: AccountStore, directory?: string);
    forAccount(ownerId: string, accountId: string): Promise<DraftStore>;
}
