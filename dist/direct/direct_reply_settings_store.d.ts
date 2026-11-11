import { AccountStore } from '../accounts/account_store.js';
import { type DirectReplyPolicy, type DirectApprovedTemplates } from './direct_auto_reply_policy.js';
export interface DirectReplySettings {
    autoReplyEnabled: boolean;
    policy: DirectReplyPolicy;
    approvedTemplates: DirectApprovedTemplates;
}
export declare class DirectReplySettingsStore {
    private readonly accounts;
    private readonly directory;
    constructor(accounts: AccountStore, directory?: string);
    private hash;
    private defaults;
    private pathFor;
    private validate;
    get(ownerId: string, accountId: string): Promise<DirectReplySettings>;
    save(ownerId: string, accountId: string, settings: DirectReplySettings): Promise<DirectReplySettings>;
}
